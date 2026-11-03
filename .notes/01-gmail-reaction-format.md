# Gmail email-reaction wire format (research notes)

Source: https://developers.google.com/workspace/gmail/reactions/format (fetched 2026-11-02)

**It is a MIME body part, not a header.** The only header involved is the standard `In-Reply-To`.

## Requirements
- A body part with `Content-Type: text/vnd.google.email-reaction+json`.
  - It may be the top-level part **or any sub-part of a multipart message**, as long as
    its `Content-Disposition` is **not** `attachment`.
- JSON body: `{"version": 1, "emoji": "👍"}`
  - `version` must be the integer `1`, not a string.
  - `emoji`: exactly one emoji (Unicode TR51 v15+; skin-tone modifiers OK).
  - Any standard Content-Transfer-Encoding is allowed. UTF-8 is required if the CTE is binary.
- `In-Reply-To:` must be a **single** Message-ID: the message being reacted to. If that
  message isn't in the recipient's thread, the reaction shows up as a normal email.
- Recommended: also include `text/plain` and `text/html` fallback parts. Google suggests
  putting the reaction part between them in a `multipart/alternative`.
- Invalid JSON, a wrong version or a bad emoji → treated as a normal email (falls back to html/plain).

## Client-side "should not offer reactions" rules (recommended, not enforced by MIME)
- The original came from a mailing list (List-* headers / Google Group).
- More than 20 distinct recipients in To + CC.
- The reacting user isn't in To/CC.
- The user has already sent more than 20 reactions to that message.

## Availability on the receiving side
- Personal Gmail: on.
- Google Workspace: **off by default**. An admin enables it under Admin console → Apps →
  Gmail → End User Access → Emoji reactions (rolled out May 2025).
  https://workspaceupdates.googleblog.com/2025/04/emoji-reactions-in-gmail.html
- Recipients on Gmail with reactions disabled, or on other clients, get a normal email
  with the html/plain fallback.

## Illustrative message (Google's recommended shape)
```
In-Reply-To: <original-id@example.com>
References: <original-id@example.com>
Content-Type: multipart/alternative; boundary="b"

--b
Content-Type: text/plain; charset=UTF-8

👍
--b
Content-Type: text/vnd.google.email-reaction+json; charset=UTF-8

{"version":1,"emoji":"👍"}
--b
Content-Type: text/html; charset=UTF-8

<p>👍</p>
--b--
```
