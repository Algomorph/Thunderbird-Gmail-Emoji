# Thunderbird Gmail Emoji

A Thunderbird add-on that sends **Gmail-native emoji reactions**. When the recipient reads
the reply in Gmail, it shows up as a reaction chip under the original message, not as a
separate email.

## How it works
A Gmail reaction is an ordinary reply that carries an `In-Reply-To` header plus an extra
MIME part:

```
Content-Type: text/vnd.google.email-reaction+json

{"version":1,"emoji":"👍"}
```

Thunderbird's compose API can't add arbitrary MIME parts, so the add-on embeds the JSON as
a `data:` URL in an invisible link in the HTML body. At send time, Thunderbird turns that
link into an inline part with the right Content-Type. `compose.beginReply()` sets the
threading headers. Details are in [`.notes/REPORT.md`](.notes/REPORT.md).

## Requirements
- Thunderbird 128 or newer (Manifest V3)
- Recipients on Gmail with reactions enabled. Google Workspace domains need an admin to
  turn them on; everyone else gets a short "👍" reply.

## Usage
Open a message and click **React** in the message header, then pick an emoji. By default the
reaction is sent straight away; a compose window flashes briefly while it is sent.

**Option** (Add-ons → Gmail Emoji Reactions → Options): *Review before sending* opens the
reaction in a compose window and lets you send it yourself.

The add-on refuses, with an explanation, where Gmail wouldn't show a reaction: mailing-list
messages, encrypted messages, a custom Reply-To, more than 20 recipients, or when you're
not in To/Cc. It also refuses to send a reaction that Thunderbird would encrypt.

**Permissions:**
- `messagesRead`: read the displayed message's headers;
- `accountsRead`: find which of your identities it was sent to;
- `compose` and `compose.send`: create and send the reply;
- `storage`: the option;
- `notifications`: report failures after the popup has closed.

## Development
Requires Node.js ≥ 20.

```sh
npm ci
npm test        # unit tests (node:test)
npm run lint    # web-ext lint: 0 errors expected; Thunderbird-only permission warnings are normal
npm run build   # dist/gmail-emoji-reactions-<version>.xpi
```

To run it: Thunderbird → Settings → Add-ons → ⚙ → **Debug Add-ons** → **Load Temporary
Add-on** → `src/manifest.json`. Pure logic lives in `src/lib/` and never calls Thunderbird
APIs directly, so it is tested under Node with fakes.

## Limitations
- The reaction part ends up nested in `multipart/related`, which relies on undocumented
  Thunderbird behaviour. Gmail web accepted it (verified with Thunderbird 157, November 2026);
  `.notes/verification-harness/run.sh` re-checks the MIME after a Thunderbird update.
- Following Gmail's rules, the add-on doesn't react to mailing-list messages or to messages
  with more than 20 recipients.
- Reactions *received* in Thunderbird still show up as normal emails.

## References
- [Gmail email reactions format](https://developers.google.com/workspace/gmail/reactions/format)
- [Thunderbird WebExtension compose API](https://webextension-api.thunderbird.net/en/latest/compose.html)
