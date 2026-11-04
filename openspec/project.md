# Project Context: ThunderbirdGmailEmoji

## What is canonical

- The repo has no tracked root `CLAUDE.md`/`AGENTS.md`. This file and
  `.dev-ext/profile.md` are the documentation: this file covers conventions, domain and
  constraints, and the profile covers commands.
- Read these in order:
  1. `README.md`;
  2. `.notes/REPORT.md`, the feasibility research;
  3. `.notes/01-gmail-reaction-format.md` and `.notes/02-thunderbird-findings.md`, the
     detailed evidence and Thunderbird source references.
- `.notes/prototype/` is a historical sketch. `src/` supersedes it.

## Repository topology and ownership

- The OpenSpec store is **in-tree**: `openspec/` is tracked in this repository, so artifacts
  version with the code and every worktree gets its own checkout.
- Artifact and code changes commit and push together, in this repository.
- Build, test and forge behaviour lives in `.dev-ext/profile.md`.

## Domain context

- The product is a Thunderbird add-on that sends **Gmail-native emoji reactions**.
- **What a reaction is.** An ordinary reply that carries:
  - `In-Reply-To: <parent Message-ID>`;
  - a MIME body part `Content-Type: text/vnd.google.email-reaction+json` with body
    `{"version":1,"emoji":"<one RGI emoji>"}`, which must not be
    `Content-Disposition: attachment`.

  Gmail shows it as a chip under the parent message. Other clients, and Gmail with
  reactions disabled, show the HTML/plain fallback.
- **How it is emitted.** Thunderbird's compose API cannot add MIME parts. Instead, the add-on
  puts an empty `<a href="data:text/vnd.google.email-reaction+json;base64,…">` in the HTML
  body.
  - At send time, Thunderbird embeds every `data:` URL as an inline `cid:` part with the URL's
    declared Content-Type, and with no Content-Disposition when the type has no file
    extension.
  - This is **undocumented Thunderbird behaviour**
    (`MessageSend.sys.mjs` `_gatherEmbeddedAttachments`, `MimePart.sys.mjs`,
    `MimeMessageUtils.sys.mjs` `pickFileNameFromUrl`). Do not "clean up" the empty anchor,
    and do not add `filename=` to the URL.
- **Invariants.**
  - The JSON payload is pure ASCII (`\uXXXX` escapes).
  - `version` is the integer 1.
  - `beginReply` always gets an explicit `identityId`, `isPlainText:false` and
    `deliveryFormat:"both"`.
  - The eligibility rules mirror Gmail's "Unable to send emoji reactions" list.

## Layout

- `src/`: the add-on root (`manifest.json`, `background.js`, `popup/`, `options/`).
- `src/lib/`: pure logic (`reaction.js`, `eligibility.js`, `send-flow.js`).
- `tests/`: `node:test` unit tests.
- `.notes/`: research and verification records.
- `openspec/`: specs and changes.

## Project conventions

### Code style

- Plain JavaScript ES modules. No bundler, TypeScript or runtime dependencies; `web-ext` is
  the only devDependency.
- Two-space indent and double quotes; match the surrounding file.
- Comments explain *why*, especially wherever Thunderbird internals are relied on.

### Architecture patterns

- `src/lib/` never references `messenger.*` or `browser.*`. Thunderbird APIs are passed in as
  an injected `api` object, so Node can test all logic with fakes.
- `background.js` is thin wiring only.
- Failure results carry `stage: "precheck" | "compose"`. The popup shows precheck failures;
  compose-stage failures go to a system notification, because the popup is gone by then.

### Documentation discipline

- Investigation records and human verification results go in `.notes/` as Markdown.
- Known Thunderbird/Gmail behaviour the code depends on is documented in this file and in
  `README.md`.

## Testing strategy

- **Automated:** `npm test` runs `node:test` unit tests over `src/lib/`: payload, validation,
  eligibility, and the send flow driven through fake Thunderbird APIs. These prove the add-on
  calls Thunderbird correctly. They do **not** prove the MIME Thunderbird emits, or that Gmail
  renders it.
- **Lint/build:** `npm run lint` must report 0 errors. Warnings for Thunderbird-only
  permissions are expected. `npm run build` must produce the `.xpi`.
- **Human:** loading the add-on in Thunderbird and reacting between two real Gmail accounts.
  This is the only evidence that reactions render, and it is required before a change touching
  the reaction body or reply settings is considered done.
- **Gate for every commit group:** `npm test && npm run lint && npm run build`.

## Git workflow

### Branch naming

`feat/<desc>`, `fix/<desc>`, `chore/<desc>`, `docs/<desc>`. There is no tracker id.

### Trunk

`main`. Never push to it directly; work lands through a pull request.

### Commit strategy

- Conventional Commits, imperative mood, optional scope, e.g.
  `feat(reaction): build Gmail reaction payload and body`.
- Common scopes: `reaction`, `eligibility`, `ui`, `options`, `build`, `docs`.
- The body explains why, when that isn't obvious.
- Before committing, the gate must pass.

### Commit Group Conventions

When authoring `tasks.md` for an OpenSpec changeset, and when implementing or
reviewing tasks, code changes must be organized into **commit groups** —
self-contained units of work that each result in one commit. Every commit group
must leave the build green and the system stable.

A typical commit group involving code changes follows these phases in order
(skip phases that do not apply):

1. **Implement changes** — the code modifications for this group
2. **Implement or adjust tests** — new tests for new behavior, updated tests for
   changed behavior
3. **Build** — build the affected targets; fix implementation or tests until the
   build succeeds
4. **Run tests** — run the relevant test suite; fix implementation and/or tests
   as appropriate until they pass
5. **Commit & push** — a single conventional commit capturing the group's work,
   immediately followed by pushing the change's feature branch to its remote

Rules:

- **Every commit group must end by committing *and* pushing to the remote.** The
  terminal subtask of each group is a "commit & push" step: create the commit,
  then `git push` the change's feature branch so work is backed up frequently.
  Never push a trunk branch (see the profile's **Branches** section); if no
  feature branch exists yet, that is a branch-setup gap to resolve before the
  group runs, not a reason to skip the push.
- This rule is repo- and worktree-agnostic: it applies identically in the source
  repo and in extended worktrees, and the push targets whatever remote the
  committed repository/branch tracks.
- No commit group may break the build or leave the system in an unstable state.
- **Every commit group that touches code must include build verification before
  its commit.**
- Changes touching existing tested functionality must re-run the relevant tests
  and adjust them if the new behavior is intentional.
- If the changeset modifies spec requirements, include a task for creating or
  verifying the delta spec files in `specs/`.
- **Dependency ordering: leaf-first.** When a changeset spans a dependency chain,
  change the lowest-level dependency first, then its consumers, and so on up the
  tree. Each commit must be self-contained: a consumer commit must never precede
  the dependency commit it relies on.
- If the changeset requires **human-in-the-loop verification** (visual checks,
  real-account email tests, manual end-to-end verification), collect those into
  a dedicated group at the very end, after every code-change group is committed
  and pushed. Fixes and test adjustments discovered while running those checks
  belong in that same final group, unless there is a strong reason to split them
  into a follow-up changeset.
- **Collecting a task into that group does not decide who runs it.** On an
  autonomous command, attempt each task in the group yourself before deferring
  it. Escalate only what actually needs a person — a GUI element you cannot
  observe, a real credential or a real second mail account — name which of
  those it is, and report the tasks you did complete.
- OpenSpec workflow operations (`openspec validate`, `openspec archive`,
  canonical-spec sync, changeset closeout, and similar tooling-level steps) must
  **not** appear as tasks in `tasks.md`.

### MR/PR requirements

- Target branch: `main`. The local gate must pass; there is no CI yet.
- Description house style: see `.dev-ext/profile.md` § **MR description format**.

### Forge CLI

`gh` against `github.com/Algomorph/Thunderbird-Gmail-Emoji`. See the profile's **Forge & CI**
section.

## Important constraints

- Never commit credentials, real email addresses of third parties, or raw message sources
  that contain other people's data. Verification notes record MIME *structure*, with
  addresses redacted.
- Do not replace the data-URL transport with API attachments: Thunderbird forces those to
  `Content-Disposition: attachment`, which Gmail ignores.
- The add-on sends email on the user's behalf. Any change that widens when it sends without
  review needs explicit sign-off.

## Heavy I/O and memory

None. The project has no datasets and no long-running jobs.

## Tracker

No tracker is configured. Tracker-driven skills should report that and stop.
