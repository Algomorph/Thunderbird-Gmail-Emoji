## Context

- **Gmail reaction format.** A reaction is a reply with an `In-Reply-To` header naming the
  parent message, plus a body part `text/vnd.google.email-reaction+json` containing
  `{"version":1,"emoji":"…"}`. That part must not be `Content-Disposition: attachment`.
  Details: `.notes/01-gmail-reaction-format.md`.
- **Thunderbird compose API limits.** The API cannot add arbitrary MIME parts, and API
  attachments are always sent as `attachment`.
- **The loophole.** At send time, Thunderbird embeds any `data:` URL found in an `<a>` or
  `<img>` of the HTML body as an inline `cid:` part. The part keeps the URL's declared
  Content-Type and gets no Content-Disposition. Details: `.notes/02-thunderbird-findings.md`.
  Resulting tree:
  `multipart/alternative[ text/plain, multipart/related[ text/html, reaction ] ]`.
- **Prototype.** `.notes/prototype/` contains an unrun MV3 sketch of the add-on.
- **Target.** Thunderbird 128+ (current local install: 157). The repo has no code yet.

## Goals / Non-Goals

**Goals:**
- One-click Gmail reactions from the message reader.
- Gmail-rule eligibility checks, with clear refusal messages.
- Pure logic separated from the WebExtension glue, so it can be unit-tested under Node with no
  dependencies.
- A reproducible `.xpi` build and a lint gate.
- Human verification against real Gmail before the change is considered done.

**Non-Goals:**
- Displaying incoming reactions in Thunderbird (collapsing or annotating them).
- An Experiment API or Gmail API send path. These are plan B, only if verification fails, and
  would be a follow-up change.
- Enforcing Gmail's "at most 20 reactions per user per message" rule. It would require
  scanning Sent folders; Gmail degrades gracefully to a normal reply.
- Publishing on addons.thunderbird.net, localization, and a message-list context menu.
- Supporting Thunderbird < 128.
- Detecting mail received through a Gmail alias (Gmail refuses reactions there). Thunderbird
  can't tell an alias from an identity, so such a reaction degrades to a normal reply.

## Decisions

1. **Layout.**
   - `src/` is the add-on root: `manifest.json`, `background.js`, `popup/`, `options/`,
     `lib/`.
   - `src/lib/*.js` are ES modules with **no `messenger.*` references**, so Node tests can
     import them directly. This covers:
     - `reaction.js`: payload, validation, body;
     - `eligibility.js`: rules over plain data objects;
     - `send-flow.js`: `react({tabId, emoji}, api)`, which takes the Thunderbird API surface
       as an injected object. Node tests drive it with fakes, so they can check call
       arguments, review vs. send, the encryption guard and error reporting.
   - `background.js` is a thin wiring layer: it passes `messenger` into `send-flow.js` and
     handles `runtime.onMessage`. It is loaded with `"type": "module"`, which works in
     TB 128+ MV3 background scripts.
   - *Alternative rejected:* a bundler or TypeScript. That is unneeded for a few hundred lines,
     and avoiding it keeps zero runtime dependencies.

2. **Reaction transport: the `data:` URL inside an empty `<a>`.**
   - The body is `<p>{emoji}</p><a href="data:text/vnd.google.email-reaction+json;base64,…"></a>`.
   - `<a>` rather than `<img>`, so non-Gmail clients show no broken-image icon.
   - The URL must not contain `filename=`, so Thunderbird emits no Content-Disposition
     (`pickFileNameFromUrl`).
   - *Alternative rejected:* API attachments, which are forced to `attachment` and ignored by
     Gmail.
   - *Alternatives deferred to plan B:* Experiment API, Gmail API.

3. **The JSON payload is pure ASCII.**
   - `JSON.stringify`, then every UTF-16 code unit ≥ U+007F is escaped as `\uXXXX`.
   - Thunderbird's charset sniffing and transfer-encoding choice then cannot corrupt the
     emoji, and Google's "binary CTE ⇒ UTF-8" clause never applies.
   - `JSON.parse` round-trips to the original emoji.

4. **Emoji validation.**
   - The emoji must match `^\p{RGI_Emoji}$` using the `v` regex flag (Firefox ≥ 116 and
     Node ≥ 20).
   - That matches Gmail's "exactly one TR51 emoji" rule closely enough. Invalid input is
     rejected before any compose window opens.
   - The picker only offers a fixed, curated set. Validation guards against future free input
     and against bugs.

5. **Reply shape.**
   - Call `compose.beginReply(id, "replyToAll", {isPlainText:false, body, deliveryFormat:"both"})`.
   - `replyToAll` matches what Gmail does: participants see the reaction.
   - `isPlainText:false` forces the HTML editor, which embedding requires.
   - Passing `body` replaces the quote, because `SetComposeDetails` assigns `innerHTML`.
   - `deliveryFormat:"both"` keeps a text/plain alternative.
   - Thunderbird generates `In-Reply-To` and `References`.
   - `identityId` is always passed explicitly, set to the identity chosen by eligibility.
     When it is omitted, the API falls back to the default identity, which can send from the
     wrong account.

6. **Send flow.**
   - The popup forwards `{emoji}` and the tab id to the background, because the popup is
     destroyed once a compose window takes focus.
   - The background then:
     1. resolves the displayed message;
     2. evaluates eligibility;
     3. opens the reply;
     4. checks `getComposeDetails().selectedEncryptionTechnology`;
     5. calls `compose.sendMessage(tab, {mode:"sendNow"})`, unless "review before sending" is
        on.
   - Every failure result carries
     `stage: "precheck"` (before any compose window opens) or `"compose"` (after).
     The popup shows precheck failures. The background notifies compose-stage failures with
     `notifications.create`, because the popup is gone by then.

7. **Encryption guard.**
   - If the opened reply has body encryption enabled, abort: close the compose tab without
     sending and notify the user.
   - Silently disabling encryption could leak a protected subject line. Encrypting would make
     the reaction unreadable to Gmail.
   - Signing-only is allowed. This is a risk to verify.

8. **Eligibility inputs.**
   - Inputs:
     - the `MessageHeader`: `recipients`, `ccList`, `headerMessageId`;
     - raw headers from `messages.getFull(id)`: `list-id`, `list-post`, `list-unsubscribe`,
       `precedence: list|bulk`, `from`, `reply-to` and the top-level `content-type`;
     - the user's identities (id, address, owning account) from `accounts.list()` (needs
       `accountsRead`), plus the message's `folder.accountId` to prefer the owning account.
   - The rules follow Gmail's "Unable to send emoji reactions" list
     (support.google.com/mail/answer/14080429): lists, encrypted originals, custom Reply-To,
     more than 20 recipients, user only in BCC.
   - Aliases are not detectable from Thunderbird and are a documented non-goal.
   - Addresses are compared case-insensitively after extracting the addr-spec from
     `"Name <addr>"`.
   - The rule functions take plain objects and return `{ok:true, identityId}` or
     `{ok:false, reason:"<user-facing text>"}`.

9. **Settings.**
   - `storage.local` holds `{reviewBeforeSend: boolean}`, default `false`, edited on an
     options page.

10. **Tooling and gates.**
    - Per commit group: `npm test` (`node --test tests/`) and `npm run lint`, which must
      report **0 errors**.
    - `web-ext lint` warns on Thunderbird-only permissions; that is expected and was checked
      on the prototype.
    - `npm run build` produces `dist/*.xpi`.
    - `web-ext` is the only devDependency.

## Risks / Trade-offs

- **[Gmail rejects the reaction part nested in `multipart/related`]** → The human
  verification group tests this first.
  - On failure, stop and open a plan-B change (Experiment API that builds Google's recommended
    `multipart/alternative[plain, reaction, html]`).
  - The pure-logic modules stay reusable.
- **[Thunderbird changes `_gatherEmbeddedAttachments`, the data-URL Content-Type, or the
  filename picking]** → The human verification group records *View Source* of a sent
  reaction, and the README documents the dependency.
  - Future work: an automated check that saves a draft (`compose.saveMessage`) and inspects
    it with `messages.getRaw`. It is deferred because it needs a running Thunderbird profile.
- **[A compose window flashes on screen before auto-send]** → Accepted for v1. There is no
  API to compose headlessly.
- **[Signed (not encrypted) reactions wrap the tree in `multipart/signed`]** → Covered in
  human verification. If Gmail rejects them, extend the guard to signing.
- **[Reaction sent from the wrong identity]** → `identityId` is passed explicitly from the
  eligibility match. A unit test covers the multi-identity case.
- **[`messageDisplay.getDisplayedMessages` returns an array in older versions and a
  `MessageList` in newer ones]** → Normalize both shapes in the background.

## Migration Plan

This is a new add-on, so there is nothing to migrate. Rollback means removing or disabling the
add-on.

## Open Questions

- Does Gmail accept the nested placement? Human verification answers this.
- Messages the user sent are refused by the "user is in To/CC" rule unless the user also
  addressed themselves. Is that too strict compared with Gmail's own UI? Observe this during
  human verification and relax it in a follow-up if needed.
