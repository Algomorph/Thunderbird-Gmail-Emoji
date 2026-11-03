# Repo Profile: ThunderbirdGmailEmoji

Repo-specific commands and conventions read by the dev-ext skills. Conventions and domain
context are in `openspec/project.md`.

## Identity

- **repoKey:** `algomorph-thunderbird-gmail-emoji`
- **Summary:** Thunderbird MV3 WebExtension written in plain JavaScript ES modules. There is no
  bundler and there are no runtime dependencies. The add-on lives in `src/` and the
  `node:test` unit tests in `tests/`. Tooling is npm plus `web-ext`.

## Forge & CI

- **forge:** `github (gh)`
- **host:** `github.com`, repository `Algomorph/Thunderbird-Gmail-Emoji`
- **CI:** none configured. The gate below is run locally before every commit.

## Branches

- **Trunk (never push directly):** `main`
- **Branch naming:** `feat/<desc>`, `fix/<desc>`, `chore/<desc>`, `docs/<desc>`. There is no
  tracker-id slot.

## Commit & MR conventions

- **Commit format:** Conventional Commits, imperative mood, optional scope, e.g.
  `feat(eligibility): refuse mailing-list messages`.
- **Common scopes:** `reaction`, `eligibility`, `ui`, `options`, `build`, `docs`.
- **MR/title linking:** none.
- **MR assignee:** the author.
- **MR labels:** none.
- **Commit-group discipline:** each OpenSpec commit group ends with one commit and a push of
  the feature branch.

### MR description format

- **Language standard:** plain English.
- **Structure, in order:**
  - `## Summary`: what changed and why, in a short paragraph;
  - `## Changes`: bullets;
  - `## Testing`: the commands run, plus any manual Thunderbird/Gmail checks.
- **Testing section:** always required. Name `npm test`, `npm run lint` and `npm run build`.
  Say which human Gmail checks were done or still pending. Unit tests do not prove that Gmail
  renders a reaction.

## Build

- Install: `npm ci`
- Build the add-on package: `npm run build` → `dist/gmail-emoji-reactions-<version>.xpi`
- Lint: `npm run lint` (`web-ext lint -s src`). The gate is **0 errors**. Warnings on the
  Thunderbird-only permissions (`messagesRead`, `compose`, …) are expected, because the linter
  only knows Firefox permissions.
- Run in Thunderbird: Settings → Add-ons → ⚙ → Debug Add-ons → Load Temporary Add-on →
  `src/manifest.json`, or install the built `.xpi`.

## Test

- All unit tests: `npm test` (`node --test tests/*.test.js`)
- One file: `node --test tests/eligibility.test.js`
- One test by name: `node --test --test-name-pattern "<regex>" tests/*.test.js`
- Gate for every commit: `npm test && npm run lint && npm run build`.
- Gmail rendering can only be verified by hand, with two real Gmail accounts. See the
  human-verification group of the active OpenSpec change.

## Onboarding

- Node.js ≥ 20, needed for `node:test` and the RegExp `v` flag.
- Thunderbird ≥ 128.
- `npm ci`, then run the gate. All three commands should succeed.
- Background reading: `README.md`, then `.notes/REPORT.md`.
