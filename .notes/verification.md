# Verification: initial-implementation

## Agent-run: Thunderbird MIME output (2026-11-03, Thunderbird 157.0 snap, headless)

Tool: `.notes/verification-harness/run.sh /snap/bin/thunderbird`. It uses a throwaway
profile:
- Local Folders only, with identity `me@example.com`;
- SMTP on `smtp.example.invalid`, with outbox auto-flush disabled.

It runs the real `src/lib/send-flow.js` in review mode against an imported message, then
queues the reply with `compose.sendMessage(..., {mode: "sendLater"})` and dumps the queued
Outbox message. This is the exact MIME that would go to SMTP, minus `X-Mozilla-*` headers.
Nothing was sent.

Result, with the original `Message-ID: <orig-123@example.com>`:

```
In-Reply-To: <orig-123@example.com>
References: <orig-123@example.com>
From: Me <me@example.com>          (the identity chosen by eligibility)
To: Ann <ann@example.com>
Subject: Re: Lunch?
Content-Type: multipart/alternative
├─ text/plain; charset=UTF-8; format=flowed        "👍"
└─ multipart/related
   ├─ text/html; charset=UTF-8                     <p>👍</p><a class="moz-txt-link-freetext" href="cid:…"></a>
   └─ Content-Type: text/vnd.google.email-reaction+json; charset=UTF-8
      Content-Id: <part1.…@example.com>
      Content-Transfer-Encoding: base64            → {"version":1,"emoji":"👍"}
      (no Content-Disposition)
```

- **Matches the spec's "Sent reaction structure" scenario:**
  - a single-ID `In-Reply-To`;
  - the reaction part present, with no `attachment` disposition;
  - a plain-text alternative containing only the emoji.
- **Defect found and fixed:** without `class="moz-txt-link-freetext"` on the anchor, the
  text/plain part also contained `<cid:part1.…@example.com>`.
- **Drafts differ:** `compose.saveMessage` drafts are saved as `multipart/related` only, with
  no text/plain alternative. They are not representative of what is sent.
- **Headless runs are not a GUI check:** they did not exercise the popup or the
  message-header button.

## Human-run (2026-11-03, Thunderbird GUI, two personal Gmail accounts)

The add-on was installed from `dist/gmail-emoji-reactions-0.1.0.xpi`.

| Task | What | Result |
|---|---|---|
| 6.1 | React button and picker appear in the message header | pass |
| 6.2 | Review mode: compose shows only the emoji, reply-all recipients; sent manually (❤️) | pass |
| 6.4 | **Gmail shows 👍 as a reaction chip** (the nested-`multipart/related` risk) | **pass**: chip under the original in Gmail web |
| 6.5 | Auto-send (👍), shows as a chip | pass |
| 6.6 | Refusal for a BCC-only message | pass: reason shown in the popup |
| 6.6 | Multi-message selection | pass: Thunderbird hides the React button, so no reaction can be started |
| 6.6 | Refusal for a mailing-list message | deferred: no list to test with (unit-tested) |
| 6.7 (old) | Encryption guard; whether a signed-only reaction renders | deferred: no OpenPGP/S-MIME configured (guard unit-tested) |
| 6.8 | Option persists across restart; From = the matched identity | pass |

Conclusion: Gmail accepts the reaction part nested in `multipart/related`, so plan B (an
Experiment API or the Gmail API) is not needed.

Follow-ups, if wanted: check the encryption guard and signed-only rendering with an
OpenPGP/S-MIME setup, and the mailing-list refusal with a real list.
