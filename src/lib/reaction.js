// Builds the content of a Gmail emoji reaction reply.
//
// Format: https://developers.google.com/workspace/gmail/reactions/format
// Transport: Thunderbird's compose API cannot add MIME parts, so the reaction
// part travels as a data: URL in an empty <a>. At send time Thunderbird embeds
// every data: URL in the HTML body as an inline cid: part with the URL's
// declared Content-Type (MessageSend.sys.mjs _gatherEmbeddedAttachments), and
// emits no Content-Disposition because the type has no file extension
// (MimeMessageUtils.sys.mjs pickFileNameFromUrl). Never add `filename=` to the
// URL: that would produce a Content-Disposition with a file name.

export const REACTION_CONTENT_TYPE = "text/vnd.google.email-reaction+json";

// Settings every reaction reply must be opened with: the HTML editor is
// required for data: URL embedding, and "both" keeps a text/plain alternative.
export const REPLY_DETAILS_BASE = Object.freeze({
  isPlainText: false,
  deliveryFormat: "both",
});

// Built with the constructor because web-ext lint's parser rejects the `v`
// flag in a regex literal. Thunderbird 128+ and Node 20+ both support it.
const SINGLE_RGI_EMOJI = new RegExp("^\\p{RGI_Emoji}$", "v");

/** True if `s` is exactly one RGI emoji (Unicode TR51). */
export function isSingleEmoji(s) {
  return typeof s === "string" && SINGLE_RGI_EMOJI.test(s);
}

/**
 * The reaction JSON, escaped to pure ASCII so Thunderbird's charset sniffing
 * and transfer-encoding choice cannot alter the emoji.
 */
export function buildPayload(emoji) {
  return JSON.stringify({ version: 1, emoji }).replace(
    /[\u007f-￿]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/**
 * The complete HTML body of a reaction reply: a visible emoji fallback for
 * clients without reaction support, plus the invisible reaction carrier.
 * Throws if `emoji` is not exactly one RGI emoji.
 */
export function buildReactionBody(emoji) {
  if (!isSingleEmoji(emoji)) {
    throw new Error(`Not a single emoji: ${JSON.stringify(emoji)}`);
  }
  const dataUrl = `data:${REACTION_CONTENT_TYPE};base64,${btoa(buildPayload(emoji))}`;
  return `<head></head><body><p>${escapeHtml(emoji)}</p><a href="${dataUrl}"></a></body>`;
}
