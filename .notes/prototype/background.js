// Prototype: send a Gmail-native emoji reaction from Thunderbird.
//
// Trick (see ../02-thunderbird-findings.md): Thunderbird embeds every data: URL
// found in an <a>/<img> of the HTML body as an *inline* MIME part. That part's
// Content-Type is the data: URL's declared type, and it gets no Content-Disposition.
// beginReply() supplies In-Reply-To/References.

// false = leave the compose window open so you can inspect it (and save a draft or
// send to yourself, then View Source). true = send immediately.
const AUTO_SEND = false;
const REPLY_TYPE = "replyToAll"; // or "replyToSender"

// Escape every non-ASCII character as \uXXXX so the JSON part is pure ASCII.
// That avoids any charset or CTE ambiguity, and JSON.parse still yields the emoji.
function asciiJson(obj) {
  return JSON.stringify(obj).replace(/[\u007f-￿]/g,
    c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function htmlEscape(s) {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

async function getDisplayedMessage(tabId) {
  const r = await messenger.messageDisplay.getDisplayedMessages(tabId);
  const list = Array.isArray(r) ? r : r?.messages; // MV2 returns an array, MV3 a MessageList
  if (!list || list.length !== 1) throw new Error("Select exactly one message.");
  return list[0];
}

async function react(tabId, emoji) {
  const msg = await getDisplayedMessage(tabId);

  // Gmail's recommended "don't offer reactions" rules.
  const full = await messenger.messages.getFull(msg.id, { decodeContent: false });
  const h = full.headers || {};
  if (h["list-id"] || h["list-post"]) throw new Error("Mailing-list message: Gmail won't treat this as a reaction.");
  const recips = new Set([...(msg.recipients || []), ...(msg.ccList || [])].map(s => s.toLowerCase()));
  if (recips.size > 20) throw new Error("More than 20 recipients: Gmail won't treat this as a reaction.");

  const json = asciiJson({ version: 1, emoji });
  const dataUrl = "data:text/vnd.google.email-reaction+json;base64," + btoa(json);
  // Empty <a> is invisible in non-Gmail clients. The visible fallback is the emoji line.
  const body =
    `<head><meta http-equiv="content-type" content="text/html; charset=UTF-8"></head>` +
    `<body><p>${htmlEscape(emoji)}</p><a href="${dataUrl}"></a></body>`;

  const composeTab = await messenger.compose.beginReply(msg.id, REPLY_TYPE, {
    isPlainText: false,
    body,                    // replaces the quoted text entirely
    deliveryFormat: "both",  // multipart/alternative[plain, related[html, reaction]]
  });

  if (AUTO_SEND) {
    await messenger.compose.sendMessage(composeTab.id, { mode: "sendNow" });
  }
}

messenger.runtime.onMessage.addListener((m) => {
  if (m?.type !== "react") return;
  return react(m.tabId, m.emoji).then(() => ({ ok: true }), e => ({ error: String(e.message || e) }));
});
