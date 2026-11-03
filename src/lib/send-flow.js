// Orchestrates sending one reaction. Thunderbird APIs are injected as `api`
// (the `messenger` global in production, fakes in tests), so this module never
// touches `messenger.*` itself.

import { checkEligibility } from "./eligibility.js";
import { buildReactionBody, isSingleEmoji, REPLY_DETAILS_BASE } from "./reaction.js";

export const REASONS = Object.freeze({
  invalidEmoji: "That isn't a single emoji.",
  encrypted:
    "This reply would be encrypted, and Gmail can't read encrypted reactions, so it was not sent.",
  unexpected: "Couldn't prepare the reaction",
  composeFailed: "The reaction was not sent",
});

// "precheck" failures happen before any compose window opens and are shown in
// the popup. "compose" failures happen after the compose window took focus,
// which closes the popup, so they are reported by notification.
const fail = (stage, reason) => ({ ok: false, stage, reason });

function errorText(e) {
  return String(e?.message ?? e);
}

// messageDisplay.getDisplayedMessages returns an array (MV2) or a MessageList (MV3).
export function normalizeMessageList(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.messages) ? result.messages : [];
}

async function gatherEligibilityInput(tabId, api) {
  const messages = normalizeMessageList(await api.messageDisplay.getDisplayedMessages(tabId));
  if (messages.length !== 1) return { messages };
  const [msg] = messages;
  const full = await api.messages.getFull(msg.id);
  const headers = { ...(full?.headers ?? {}) };
  if (!headers["content-type"] && full?.contentType) headers["content-type"] = [full.contentType];
  const accounts = await api.accounts.list(false);
  const identities = accounts.flatMap((account) =>
    (account.identities ?? []).map((i) => ({ id: i.id, email: i.email, accountId: account.id })),
  );
  return { messages, headers, identities, folderAccountId: msg.folder?.accountId };
}

/**
 * Sends (or opens for review) a reaction to the message displayed in `tabId`.
 * Never throws.
 * @returns {Promise<{ok: true} | {ok: false, stage: "precheck"|"compose", reason: string}>}
 */
export async function react({ tabId, emoji }, api) {
  let input;
  try {
    if (!isSingleEmoji(emoji)) return fail("precheck", REASONS.invalidEmoji);
    input = await gatherEligibilityInput(tabId, api);
  } catch (e) {
    return fail("precheck", `${REASONS.unexpected}: ${errorText(e)}`);
  }
  const decision = checkEligibility(input);
  if (!decision.ok) return fail("precheck", decision.reason);

  let composeTab;
  try {
    composeTab = await api.compose.beginReply(input.messages[0].id, "replyToAll", {
      ...REPLY_DETAILS_BASE,
      identityId: decision.identityId,
      body: buildReactionBody(emoji),
    });

    const details = await api.compose.getComposeDetails(composeTab.id);
    if (details?.selectedEncryptionTechnology?.encryptBody) {
      // Mark unmodified first so closing doesn't raise a "save changes?" prompt.
      await api.compose.setComposeDetails(composeTab.id, { isModified: false });
      await api.tabs.remove(composeTab.id);
      return fail("compose", REASONS.encrypted);
    }

    const { reviewBeforeSend } = await api.storage.local.get({ reviewBeforeSend: false });
    if (!reviewBeforeSend) {
      await api.compose.sendMessage(composeTab.id, { mode: "sendNow" });
    }
    return { ok: true };
  } catch (e) {
    return fail("compose", `${REASONS.composeFailed}: ${errorText(e)}`);
  }
}

/**
 * runtime.onMessage handler: runs `react` and notifies compose-stage failures,
 * which the (by then closed) popup can no longer show. Returns the result to
 * the popup either way.
 */
export async function handleRuntimeMessage(message, api) {
  if (message?.type !== "react") return undefined;
  const result = await react({ tabId: message.tabId, emoji: message.emoji }, api);
  if (!result.ok && result.stage === "compose") {
    try {
      await api.notifications.create({
        type: "basic",
        title: "Reaction not sent",
        message: result.reason,
      });
    } catch {
      // Nothing else can surface the failure; the result still goes to the popup.
    }
  }
  return result;
}
