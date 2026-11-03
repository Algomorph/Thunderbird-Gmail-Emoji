# Thunderbird add-on capabilities vs. the Gmail reaction format

Local install: Thunderbird 157.0 (snap). The source quoted below is comm-central tip,
fetched 2026-11-02 from hg.mozilla.org. The send pipeline has been JS since TB ~91.

## What the plain WebExtension compose API gives us
API docs: https://webextension-api.thunderbird.net/en/latest/compose.html
- `compose.beginReply(messageId, replyType, details)` sets `In-Reply-To` and `References`
  natively. **That covers the header half of the problem.**
- `ComposeDetails.customHeaders` (TB 100+) only allows `X-*` (not `X-Mozilla-*`), `List-*`
  and `msip_labels` (`ext-compose.js` `sanitizeCustomHeaderName`). This doesn't matter,
  because reactions don't need custom headers.
- Body inputs are only `body` (HTML) and `plainTextBody`. There is no raw-MIME or
  "add part with arbitrary Content-Type" API.
- Attachments added through the API always go out as `Content-Disposition: attachment`
  (`MimeMessage.sys.mjs` `_gatherAttachmentParts` → `setBodyAttachment(attachment)` with the
  default `"attachment"`). **Gmail ignores those for reactions.** Dead end.
- `compose.sendMessage(tabId, {mode: "sendNow"})` (TB 90+, permission `compose.send`) can
  send without the user clicking.

## The loophole: `data:` URLs in the HTML body become *inline* MIME parts
1. `setComposeDetails`/`beginReply` with `body` → `MsgComposeCommands.js` `SetComposeDetails`
   does `editor.document.documentElement.innerHTML = newValues.body`. **No sanitizing**,
   so `<a href="data:...">` survives.
2. At send, `MessageSend.sys.mjs` `_gatherEmbeddedAttachments` walks `img`, `a` and
   `body[background]`. **Any** URL matching `/^(data|nntp):/` is embedded as a `cid:` part
   (this applies to `<a>` too, not just images).
3. `MimeMessage.sys.mjs` `_gatherEmbeddedParts` → `setBodyAttachment(att, "inline", cid)`,
   so the disposition is **inline**.
4. `MimePart.sys.mjs` `_fetchAttachment`: for non-file URLs, Content-Type =
   `channel.contentType`. For a `data:` URL, that is the declared MIME type, i.e.
   `text/vnd.google.email-reaction+json`.
5. `MimeMessageUtils.sys.mjs` `pickFileNameFromUrl`: for a `data:` URL whose type has no
   known file extension it returns `""`, so **no `Content-Disposition` header is emitted
   at all**. It also emits `Content-ID` and a CTE, both harmless.

Resulting structure (HTML compose, `deliveryFormat: "both"`):
```
multipart/alternative
├─ text/plain                      (auto-generated from the HTML)
└─ multipart/related
   ├─ text/html                    (<a href="cid:..."></a>, invisible)
   └─ text/vnd.google.email-reaction+json   (Content-ID, no Content-Disposition)
```
Plus `In-Reply-To`/`References` from `beginReply`. This satisfies the spec as written
("sub-part of a multipart message, not disposition attachment"). It is **not** Google's
*recommended* placement (between plain and html). **Gmail's acceptance of the nested
`multipart/related` placement is untested.** That is the one open risk.

## Fallback routes if Gmail rejects the nested placement
- **Experiment API** (privileged add-on code): either wrap or patch the `MimeMessage` build,
  or build raw MIME yourself and send it through the `nsIMsgSend`/SMTP layer. This gives full
  control of the structure. Downsides: it can break across TB versions, and ATN review is
  stricter. It is still fine for personal use.
- **Gmail API** `users.messages.send` with a raw RFC 822 message plus `threadId`, using
  OAuth from the extension (`identity.launchWebAuthFlow`). Downsides: Gmail accounts only,
  it needs your own GCP OAuth client, and the `gmail.send` scope needs Google
  verification for public distribution.

## Other notes
- Thunderbird has no native support for showing reactions. Incoming Gmail reactions show
  up as ordinary short emails. A display-side add-on (collapse or annotate them) is a
  separate, also feasible, feature.
- Existing add-ons and bugs: none found that implement Gmail reactions.
