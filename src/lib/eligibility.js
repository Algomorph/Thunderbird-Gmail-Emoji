// Decides whether a displayed message may receive a Gmail reaction.
// The rules mirror Gmail's "Unable to send emoji reactions" list
// (https://support.google.com/mail/answer/14080429). Mail received through a
// Gmail alias cannot be detected from Thunderbird and is not checked.

export const MAX_RECIPIENTS = 20;

export const REASONS = Object.freeze({
  notSingle: "Select a single message to react to.",
  noMessageId: "This message has no Message-ID, so a reaction can't be attached to it.",
  mailingList: "Gmail doesn't support reactions to mailing-list messages.",
  encrypted: "Gmail doesn't support reactions to encrypted messages.",
  replyTo:
    "The sender set a different Reply-To address, so Gmail wouldn't show this as a reaction.",
  tooManyRecipients: `Gmail doesn't support reactions to messages with more than ${MAX_RECIPIENTS} recipients.`,
  notDirectRecipient:
    "You're not a direct (To or Cc) recipient of this message, so Gmail wouldn't show a reaction.",
});

/** Splits an RFC 5322 address list on top-level commas (not inside quotes or <>). */
export function parseAddressList(value) {
  const out = [];
  let current = "";
  let inQuotes = false;
  let angleDepth = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "\\" && inQuotes) {
      current += c + (value[++i] ?? "");
      continue;
    }
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === "<") angleDepth++;
    else if (!inQuotes && c === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (c === "," && !inQuotes && angleDepth === 0) {
      out.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The lower-cased addr-spec of a single mailbox such as `"Ann" <Ann@X.com>`. */
export function extractAddress(mailbox) {
  const s = String(mailbox ?? "").trim();
  const angle = s.match(/<([^<>]*)>\s*$/);
  return (angle ? angle[1] : s).trim().replace(/^"|"$/g, "").toLowerCase();
}

function addressesOf(values) {
  return values
    .flatMap((v) => parseAddressList(String(v ?? "")))
    .map(extractAddress)
    .filter(Boolean);
}

// messages.getFull() returns header values as arrays; tolerate plain strings.
function headerValues(headers, name) {
  const v = headers?.[name];
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map(String).filter((s) => s.trim() !== "");
}

const refuse = (reason) => ({ ok: false, reason });

/**
 * @param {object} input
 * @param {object[]} input.messages - displayed MessageHeader objects
 * @param {object} input.headers - top-level headers from messages.getFull()
 * @param {{id: string, email: string, accountId: string}[]} input.identities
 * @param {string} [input.folderAccountId] - account owning the message's folder
 * @returns {{ok: true, identityId: string} | {ok: false, reason: string}}
 */
export function checkEligibility({ messages, headers, identities, folderAccountId }) {
  if (!Array.isArray(messages) || messages.length !== 1) return refuse(REASONS.notSingle);
  const msg = messages[0];

  if (!String(msg.headerMessageId ?? "").trim()) return refuse(REASONS.noMessageId);

  const isList =
    ["list-id", "list-post", "list-unsubscribe"].some(
      (h) => headerValues(headers, h).length > 0,
    ) || headerValues(headers, "precedence").some((v) => /^\s*(list|bulk)\s*$/i.test(v));
  if (isList) return refuse(REASONS.mailingList);

  const contentType = headerValues(headers, "content-type")[0] ?? "";
  if (/^\s*(multipart\/encrypted|application\/(x-)?pkcs7-mime)\s*(;|$)/i.test(contentType)) {
    return refuse(REASONS.encrypted);
  }

  const replyTo = addressesOf(headerValues(headers, "reply-to"));
  if (replyTo.length > 0) {
    const fromValues = headerValues(headers, "from");
    const from = new Set(addressesOf(fromValues.length ? fromValues : [msg.author]));
    if (replyTo.some((a) => !from.has(a))) return refuse(REASONS.replyTo);
  }

  const recipients = new Set(addressesOf([...(msg.recipients ?? []), ...(msg.ccList ?? [])]));
  if (recipients.size > MAX_RECIPIENTS) return refuse(REASONS.tooManyRecipients);

  const matching = (identities ?? []).filter((i) =>
    recipients.has(extractAddress(i.email)),
  );
  if (matching.length === 0) return refuse(REASONS.notDirectRecipient);
  const chosen = matching.find((i) => i.accountId === folderAccountId) ?? matching[0];
  return { ok: true, identityId: chosen.id };
}
