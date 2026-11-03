## Why

Gmail renders emoji reactions as chips under the original message, but Thunderbird can only
send plain replies, so a reaction from Thunderbird reaches Gmail users as a separate email.
The investigation in `.notes/REPORT.md` found a way to emit the Gmail reaction MIME part from an
unprivileged WebExtension, and `.notes/prototype/` sketches it. This change turns that
prototype into a maintained, tested add-on, and settles the one open risk: whether Gmail accepts
the reaction part nested inside `multipart/related`.

## What Changes

- Add a Manifest V3 Thunderbird add-on under `src/` (min Thunderbird 128) that places a
  **React** button in the message header. The button opens an emoji picker.
- Picking an emoji sends a reply that Gmail recognizes as a reaction:
  - a `text/vnd.google.email-reaction+json` part, smuggled in as a `data:` URL in the HTML
    body (see `.notes/02-thunderbird-findings.md`);
  - threading headers from `compose.beginReply()`;
  - a visible emoji fallback for non-Gmail clients.
- Refuse to react where Gmail would not treat the reply as a reaction:
  - mailing-list messages;
  - encrypted originals;
  - a custom Reply-To that differs from From;
  - more than 20 distinct To+CC recipients;
  - the user is not in To/CC;
  - no Message-ID;
  - multi-message selection.
- Refuse to send a reaction if the reply would be encrypted.
- Always send from the identity that the original was addressed to, passed explicitly to
  `beginReply`.
- Known gap: mail received through a Gmail alias cannot be detected. Such reactions arrive as
  normal replies.
- Report every refusal or failure to the user (in the popup, or by a notification once the
  popup has closed).
- One option, "review before sending": open the compose window instead of sending immediately.
- Development tooling with no runtime dependencies:
  - `package.json` with `test` (`node --test`), `lint` (`web-ext lint`) and `build`
    (`web-ext build` → `.xpi`);
  - unit tests for all pure logic;
  - `.gitignore`;
  - `.dev-ext/profile.md` and `openspec/project.md` filled in from their templates.
- The README's Development section points at `src/` instead of `.notes/prototype/`.

## Capabilities

### New Capabilities
- `reaction-message`: Content of a reaction reply:
  - JSON payload format and emoji validation;
  - the HTML body carrying the `data:` URL reaction part;
  - fallback text;
  - required threading and delivery-format settings.
- `reaction-eligibility`: Rules that decide whether a displayed message may be reacted to, and
  the user-facing reason when it may not.
- `reaction-ui`: The React message-header button, the emoji picker, the send/review flow, the
  "review before sending" option, the encryption guard, and error reporting.

### Modified Capabilities
<!-- none: openspec/specs/ is empty -->

## Impact

- New code: `src/` (manifest, background script, popup, options page, pure-logic modules) and
  `tests/`.
- New dev tooling: `package.json` with `web-ext` as the only devDependency. Node ≥ 20 is needed
  for `node:test` and `RegExp` `v` flag support.
- Add-on permissions: `messagesRead`, `accountsRead`, `compose`, `compose.send`, `storage`,
  `notifications`.
- Docs: `README.md`, `.dev-ext/profile.md`, `openspec/project.md`.
- External behaviour: the add-on sends email on the user's behalf from their configured SMTP
  identity. Nothing else leaves the machine; there is no network access beyond normal sending.
- Depends on Thunderbird internals that aren't part of the documented API. The behaviour is
  pinned by the human verification group and recorded as a risk in `design.md`.
