#!/usr/bin/env bash
# Headless check of the MIME Thunderbird actually emits for a reaction.
# Builds a throwaway profile (Local Folders only, a fake identity, and an SMTP
# server on a .invalid host with outbox auto-flush disabled), then runs the
# real src/lib send flow in review mode and queues the reply with "send later".
# Nothing can leave the machine. Prints the queued message's raw source.
#
# Usage: .notes/verification-harness/run.sh [thunderbird-binary]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
tb="${1:-thunderbird}"
# The Thunderbird snap can only read its own data dir (and non-hidden home dirs).
if [ -d "${HOME}/snap/thunderbird/common" ]; then
  work="$(mktemp -d "${HOME}/snap/thunderbird/common/gmail-emoji-verify.XXXXXX")"
else
  work="$(mktemp -d)"
fi
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/harness/lib" "$work/profile/extensions"
cp "$here/manifest.json" "$here/background.js" "$work/harness/"
cp "$repo"/src/lib/*.js "$work/harness/lib/"
cp "$here/user.js" "$work/profile/user.js"
(cd "$work/harness" && zip -qr "$work/profile/extensions/reaction-harness@local.xpi" .)
# Thunderbird does not exit on its own; 60 s is ample for the harness to finish.
(cd "$HOME" && timeout 60 "$tb" --headless --no-remote --profile "$work/profile" >"$work/out.log" 2>&1) || true
grep -a "HARNESS" "$work/out.log" | sed 's/\\r\\n/\n/g; s/\\n/\n/g'
