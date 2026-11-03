# Gmail-native emoji reactions from Thunderbird: feasibility report
*2026-11-02 · Thunderbird 157 · details in `01-gmail-reaction-format.md` and `02-thunderbird-findings.md`*

## Verdict
**Feasible as a normal (non-privileged) WebExtension**, with one empirical check still
open: whether Gmail accepts the reaction part when it is nested inside `multipart/related`.
No dead end, so Codex was not consulted.

## The premise needs one correction
Gmail reactions are **not header-based**. A reaction is an ordinary reply that carries:
1. a body part `Content-Type: text/vnd.google.email-reaction+json` with body
   `{"version":1,"emoji":"👍"}`, which must **not** be `Content-Disposition: attachment`
   (it may sit anywhere in the MIME tree), and
2. a standard `In-Reply-To: <parent Message-ID>` header.

Thunderbird's header restrictions (`customHeaders` only allows `X-*`, `List-*` and
`msip_labels`) are therefore irrelevant. `compose.beginReply()` already sets
`In-Reply-To`/`References`. **The real obstacle is the body part**: the compose API has no
raw-MIME input, and attachments added through the API are always sent as
`Content-Disposition: attachment`, which Gmail ignores.

## The workaround
At send time, Thunderbird turns every `data:` URL in an `<a>`/`<img>` of the HTML body into
an **inline** `cid:` part (`MessageSend.sys.mjs` `_gatherEmbeddedAttachments`). The part's
Content-Type is copied from the `data:` URL, and **no `Content-Disposition` is emitted** when
the type has no known file extension. The compose API inserts HTML through unsanitized
`innerHTML`, so this survives:
```html
<p>👍</p><a href="data:text/vnd.google.email-reaction+json;base64,eyJ2ZXJzaW9uIjoxLCJlbW9qaSI6Ilx1ZDgzZFx1ZGM0ZCJ9"></a>
```
With `beginReply(id, "replyToAll", {isPlainText:false, body, deliveryFormat:"both"})` and,
optionally, `compose.sendMessage(tab, {mode:"sendNow"})`, the wire result is:
`multipart/alternative[ text/plain, multipart/related[ text/html, text/vnd.google.email-reaction+json ] ]`
plus `In-Reply-To`. That matches Google's spec as written. It is **not** Google's
*recommended* placement (reaction between plain and html).

A working prototype (MV3, message-pane popup with 8 emoji) is in `.notes/prototype/`.
Syntax and the JSON/base64 encoding were checked. **It has not been run in Thunderbird.**

## Risks and caveats
| Risk | Severity | Note |
|---|---|---|
| Gmail rejects the reaction part inside `multipart/related` | **Main unknown** | If so, go to plan B |
| Relies on undocumented behaviour of TB internals | Medium | Stable since TB ~91; could change in any release |
| Recipient's Workspace admin hasn't enabled reactions (off by default) | Info | They get a plain "👍" reply; personal Gmail works by default |
| Non-Gmail recipients | Low | They see a short "👍" email; some clients may list an unnamed inline part |
| Gmail's client rules (no lists, ≤20 recipients, ≤20 reactions per user) | Low | Prototype checks the first two |

## Plan B (only if the test fails)
1. **Experiment API** (privileged add-on): build the exact MIME Google recommends and send it
   through TB's SMTP layer. This gives full control, but it is version-fragile and gets
   stricter ATN review.
2. **Gmail API** `users.messages.send` (raw MIME + `threadId`) via OAuth. It is robust, but
   Gmail-only, needs your own GCP OAuth client, and public distribution needs scope
   verification.

## Next step (about 10 minutes)
1. In TB: Settings → Add-ons → ⚙ → *Debug Add-ons* → *Load Temporary Add-on* →
   `.notes/prototype/manifest.json`.
2. Open a message that another **personal Gmail** account sent to you (not yourself, not a
   list). Click **React** → 👍. The compose window opens (`AUTO_SEND=false`). Send it.
3. Check the other account in Gmail web. A 👍 chip under the message means success; a
   separate "👍" email means the nesting was rejected. In TB's Sent folder, *View Source*
   confirms the MIME structure.
