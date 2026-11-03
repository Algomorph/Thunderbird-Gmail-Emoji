Gate for every code group: `npm test` passes, `npm run lint` reports 0 errors (warnings on
Thunderbird-only permissions are expected), and `npm run build` produces `dist/*.xpi`.
Trunk is `main`; all commits go to the feature branch `feat/initial-implementation`.

## 1. Scaffolding and tooling

- [x] 1.1 Create and push the feature branch `feat/initial-implementation` from `main`.
- [x] 1.2 Add `.gitignore` covering `node_modules/` and `dist/`.
- [x] 1.3 Add `package.json`:
  - `"type": "module"` and `engines.node >= 20`;
  - `web-ext` as the only devDependency;
  - scripts `test` (`node --test tests/*.test.js`), `lint` (`web-ext lint -s src`) and `build`
    (`web-ext build -s src -a dist --overwrite-dest`, renamed to `.xpi`).
  - Commit `package-lock.json`.
- [x] 1.4 Add the `src/manifest.json` skeleton:
  - MV3, gecko id, `strict_min_version` 128.0;
  - background `{scripts: ["background.js"], type: "module"}` with an empty `background.js`;
  - `data_collection_permissions` declaring no collection.
- [x] 1.5 Add `tests/smoke.test.js` asserting that `src/manifest.json` parses, is MV3 and has
  `strict_min_version` ≥ 128, so `npm test` has a real target.
- [x] 1.6 Fill in `.dev-ext/profile.md`:
  - Identity summary;
  - Forge (github, `gh`);
  - Branches (`main` trunk, `feat/<desc>`);
  - Commit format (Conventional Commits);
  - Build and Test sections with the npm commands;
  - Onboarding: Node ≥ 20, Thunderbird ≥ 128.
  - Remove the template placeholders. Delete sections that don't apply (Tracker: none).
- [x] 1.7 Fill in `openspec/project.md` from its template:
  - What is canonical (this file plus the profile; `.notes/` for research);
  - Domain context (the Gmail reaction format, and the data-URL dependency on Thunderbird
    internals);
  - Layout (`src/`, `src/lib/`, `tests/`);
  - Code style (plain ES modules, no bundler, no runtime dependencies);
  - Architecture rule: `src/lib/` never references `messenger.*`;
  - Testing strategy (`node:test` units with fakes, plus the human Gmail check);
  - Git workflow (trunk `main`, `feat/<desc>`, Conventional Commits).
  - Delete the sections that don't apply (Heavy I/O: none; Tracker: none).
- [x] 1.8 Check the three delta specs under this change's `specs/` against `proposal.md`
  Capabilities and `design.md`. Each capability has one spec, each requirement has a scenario,
  and no requirement contradicts the design. Fix any mismatch in this group.
- [x] 1.9 Run the gate (`npm ci && npm test && npm run lint && npm run build`); fix anything
  that fails.
- [x] 1.10 Commit `chore: scaffold add-on, tooling and repo profile`, including this OpenSpec
  change directory. Push the feature branch.

## 2. Reaction message (leaf logic)

- [x] 2.1 Implement `src/lib/reaction.js`:
  - `isSingleEmoji(s)` using `^\p{RGI_Emoji}$` with the `v` flag (built with `new RegExp`,
    because web-ext lint's parser rejects `v` regex literals);
  - `buildPayload(emoji)`, ASCII-escaped JSON;
  - `buildReactionBody(emoji)`, which throws on invalid emoji, HTML-escapes the fallback and
    emits one empty `<a href="data:text/vnd.google.email-reaction+json;base64,…">`;
  - `REPLY_DETAILS_BASE = {isPlainText:false, deliveryFormat:"both"}`.
- [x] 2.2 Add `tests/reaction.test.js` covering every scenario in
  `specs/reaction-message/spec.md` except the human-verified ones:
  - the exact payload for 👍;
  - the ❤️ round-trip and ASCII-only check;
  - valid and invalid emoji lists;
  - body contents, base64 decode and the absence of `filename=`.
- [x] 2.3 Run the gate; fix the implementation or tests until it passes.
- [x] 2.4 Commit `feat(reaction): build Gmail reaction payload and body`. Push.

## 3. Eligibility rules (leaf logic)

- [x] 3.1 Implement `src/lib/eligibility.js`:
  - `extractAddress(str)`: addr-spec from `"Name <addr>"`, lower-cased;
  - `checkEligibility({messages, headers, identities: [{id, email, accountId}], folderAccountId})`, applying the rules in spec
    order: single message, Message-ID, list headers or precedence, encrypted original
    (`multipart/encrypted`, `application/pkcs7-mime`), Reply-To differing from From, ≤ 20
    distinct To+CC, user in To/CC. Returns `{ok:true, identityId}` (prefer the identity of the
    message folder's account) or `{ok:false, reason}`.
- [x] 3.2 Add `tests/eligibility.test.js` covering every scenario in
  `specs/reaction-eligibility/spec.md`, including:
  - the 20/21 boundary;
  - case and display-name dedup;
  - `Precedence: Bulk`;
  - encrypted original;
  - Reply-To differing from From vs. equal to it;
  - identity choice when two accounts match;
  - rule-order precedence when several rules fail.
- [x] 3.3 Run the gate; fix the implementation or tests until it passes.
- [x] 3.4 Commit `feat(eligibility): enforce Gmail reaction eligibility rules`. Push.

## 4. Send flow, popup and background wiring

- [x] 4.1 Implement `src/lib/send-flow.js` `react({tabId, emoji}, api)`. Steps:
  1. normalize the `getDisplayedMessages` array/`MessageList` shape;
  2. gather headers (`messages.getFull`), identities (`accounts.list`) and the folder's
     account;
  3. check eligibility and validate the emoji;
  4. `compose.beginReply(id, "replyToAll", {...REPLY_DETAILS_BASE, identityId, body})`;
  5. `compose.getComposeDetails`: if `selectedEncryptionTechnology?.encryptBody`, then
     `setComposeDetails({isModified:false})` (avoids a "save changes?" prompt), `tabs.remove`,
     and return an error;
  6. read `reviewBeforeSend` from `storage.local`; if it is off,
     `compose.sendMessage(tab.id, {mode:"sendNow"})`.

  Return `{ok:true}` or `{ok:false, stage, reason}`, where `stage` is `"precheck"` or
  `"compose"`. Never throw to the caller.
- [x] 4.2 Implement `src/background.js` as wiring only. The handler itself,
  `handleRuntimeMessage(message, api)`, lives in `src/lib/send-flow.js`, so it is testable:
  - `runtime.onMessage` handler for `{type:"react"}`, calling `react(..., messenger)`;
  - when a result has `stage: "compose"`, call `notifications.create` with the reason;
  - return every result to the popup.
- [x] 4.3 Implement `src/popup/popup.html` and `popup.js`:
  - eight emoji `<button>`s with `aria-label`;
  - send `{type:"react", tabId, emoji}`;
  - show `reason` inline on refusal; close on success.
- [x] 4.4 Update `src/manifest.json`:
  - `message_display_action` (title "React", popup);
  - permissions `messagesRead`, `accountsRead`, `compose`, `compose.send`, `storage`,
    `notifications`.
- [x] 4.5 Add `tests/send-flow.test.js` with a fake `api` object, covering the
  `specs/reaction-ui/spec.md` scenarios that don't need a GUI:
  - `beginReply` arguments, including `identityId` for a message addressed to a secondary
    identity (from `specs/reaction-message`);
  - auto-send vs. review (no `sendMessage` call);
  - an ineligible message makes no `beginReply` call;
  - encryption guard (`tabs.remove` called, no send);
  - `sendMessage` rejection returns `{ok:false, stage:"compose"}` with the error text;
  - an eligibility refusal returns `stage:"precheck"`;
  - a background-wiring test (fake `messenger`) shows that only compose-stage failures create
    a notification;
  - both `getDisplayedMessages` return shapes.
- [x] 4.6 Run the gate; fix the implementation or tests until it passes.
- [x] 4.7 Commit `feat(ui): React button, emoji picker and send flow`. Push.

## 5. Options page and docs

- [x] 5.1 Implement `src/options/options.html` and `options.js`: a "Review before sending"
  checkbox bound to `storage.local.reviewBeforeSend` (default false). Register it in the
  manifest under `options_ui`.
- [x] 5.2 Update `README.md`:
  - Development section: load `src/manifest.json`, `npm test`, `npm run lint`,
    `npm run build`;
  - permissions list and the option;
  - drop the reference to `.notes/prototype/`.
- [x] 5.3 Run the gate; fix anything that fails.
- [x] 5.4 Commit `feat(options): review-before-sending option; docs`. Push.

## 6. Human-in-the-loop verification

Needs a person: two real Gmail accounts and a running Thunderbird GUI. The agent should still:
- load the add-on;
- inspect sent messages through `messages.getRaw` / View Source where it can reach them.

- [x] 6.1 Load `dist/*.xpi` (or `src/manifest.json` as a temporary add-on) in Thunderbird ≥ 128
  with a Gmail account. Confirm the "React" button and picker appear.
- [x] 6.2 With "Review before sending" on, react to a message that a second **personal**
  Gmail account sent directly to you. Confirm the compose window has the emoji only (no
  quote) and the reply-all recipients. Send it manually.
- [x] 6.3 (Done by the agent with `.notes/verification-harness/run.sh`, using the queued
  send-later message.) View Source of the sent reaction. Record in `.notes/verification.md`:
  - the MIME tree;
  - `In-Reply-To`;
  - the reaction part's headers (Content-Type, absence of `Content-Disposition: attachment`,
    CTE).
  - Compare against `specs/reaction-message` "Sent reaction structure".
- [x] 6.4 **Critical check.** In the second account's Gmail web UI, confirm 👍 shows as a
  reaction chip under the original, not as a separate message. If it shows as a separate
  message, stop. Record the failure and open a plan-B follow-up change (see `design.md`
  Risks).
- [x] 6.5 Turn "Review before sending" off and react. Confirm it is sent without interaction
  and appears as a chip.
- [x] 6.6 Confirm refusals for:
  - a message where you are only in BCC (popup shows the reason);
  - a multi-message selection (Thunderbird hides the React button, so the popup cannot open).

  The mailing-list refusal is deferred out of this change (no list available to test with);
  it remains unit-tested.
- [x] 6.7 Add the add-on icon: scale `graphics/logo.png` to `src/icons/icon-{16..128}.png`,
  declare them in the manifest (`icons`, `message_display_action.default_icon`), and add a
  smoke test that every declared icon exists. Run the gate. Commit
  `feat(ui): add the add-on icon`. Push.
- [x] 6.8 Restart Thunderbird and confirm the option persists. If you have two identities,
  react to a message addressed to the non-default one and confirm the From address.
- [x] 6.9 Fix any defects found in this group and re-run the gate. Then make **one** commit,
  `test: record Gmail verification results`, containing `.notes/verification.md` and any
  fixes. Push. If a fix is too large for this group, record it in `.notes/verification.md`
  as a follow-up change instead.

Deferred out of this change (no OpenPGP/S-MIME setup or mailing list to test with): the
encryption guard and signed-only rendering in a real Thunderbird, and the mailing-list refusal
in the popup. All three remain covered by unit tests; see `.notes/verification.md`.
