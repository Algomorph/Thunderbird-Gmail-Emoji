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

## Development
1. Thunderbird → Settings → Add-ons → ⚙ → **Debug Add-ons** → **Load Temporary Add-on**.
2. Pick `manifest.json`. For now, that's the one in `.notes/prototype/`.
3. Open a message, click **React** in the message header and pick an emoji.

## Limitations
- The structure Thunderbird produces (the reaction part nested in `multipart/related`) has
  not yet been confirmed to work with Gmail.
- Following Gmail's rules, the add-on doesn't react to mailing-list messages or to messages
  with more than 20 recipients.
- Reactions *received* in Thunderbird still show up as normal emails.

## References
- [Gmail email reactions format](https://developers.google.com/workspace/gmail/reactions/format)
- [Thunderbird WebExtension compose API](https://webextension-api.thunderbird.net/en/latest/compose.html)
