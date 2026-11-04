## ADDED Requirements

### Requirement: Reaction payload format
The add-on SHALL encode a reaction as the JSON object `{"version":1,"emoji":"<emoji>"}`.
`version` SHALL be the integer `1`. Every character at or above U+007F SHALL be escaped as
`\uXXXX`, so the serialized payload is pure ASCII and `JSON.parse` returns the original emoji.

#### Scenario: Thumbs-up payload
- **WHEN** a payload is built for `👍`
- **THEN** the result is exactly the ASCII string `{"version":1,"emoji":"\ud83d\udc4d"}` (the emoji as an escaped surrogate pair)

#### Scenario: Multi-code-point emoji round-trips
- **WHEN** a payload is built for `❤️` (U+2764 U+FE0F)
- **THEN** the result contains only ASCII characters
- **AND** `JSON.parse(result).emoji` equals `❤️`
- **AND** `JSON.parse(result).version` is the number `1`

### Requirement: Single-emoji validation
The add-on SHALL accept only a string that is exactly one RGI emoji (Unicode TR51). It SHALL
reject anything else before opening a compose window.

#### Scenario: Valid emoji accepted
- **WHEN** validation runs on `👍`, `❤️`, `👍🏽` or `🧑‍💻`
- **THEN** each is accepted

#### Scenario: Invalid input rejected
- **WHEN** validation runs on `""`, `"a"`, `"👍👍"`, `"👍 "` or `":)"`
- **THEN** each is rejected
- **AND** building a reaction body for it throws an error

### Requirement: Reaction body carries the reaction part as a data URL
The HTML body of a reaction reply SHALL contain:
- a visible fallback paragraph with the HTML-escaped emoji;
- exactly one empty `<a>` element whose `href` is
  `data:text/vnd.google.email-reaction+json;base64,<base64 of the payload>`, and whose
  `class` is `moz-txt-link-freetext`. Without that class, Thunderbird's HTML-to-text
  conversion prints the link target (`<cid:…>`) in the text/plain alternative.

The `data:` URL SHALL NOT contain a `filename=` parameter. The body SHALL contain no other
`data:` URLs and no quoted original message.

#### Scenario: Body content for thumbs-up
- **WHEN** a reaction body is built for `👍`
- **THEN** it contains `<p>👍</p>`
- **AND** it contains exactly one `href="data:text/vnd.google.email-reaction+json;base64,`
- **AND** base64-decoding that URL's data yields the payload for `👍`
- **AND** the string `filename=` does not occur
- **AND** the anchor has `class="moz-txt-link-freetext"`

### Requirement: Reaction reply settings
The add-on SHALL open every reaction reply with `compose.beginReply` using:
- reply type `replyToAll`;
- `isPlainText: false` and `deliveryFormat: "both"`;
- `identityId` set to the identity chosen by eligibility (see `reaction-eligibility`);
- the reaction body as the complete HTML body.

The add-on SHALL NOT rely on Thunderbird's default identity selection.

#### Scenario: Reply details
- **WHEN** a reaction is sent for a message
- **THEN** `compose.beginReply` is called with that message's id and `"replyToAll"`
- **AND** the details passed have `isPlainText` `false`, `deliveryFormat` `"both"`,
  `identityId` equal to the identity chosen by eligibility, and `body` equal to the reaction
  body

#### Scenario: Message addressed to a secondary identity
- **WHEN** the user has identities A (default) and B
- **AND** the message's To contains only B's address
- **THEN** `compose.beginReply` receives B's identity id

#### Scenario: Sent reaction structure (verified by a human)
- **WHEN** a reaction sent by the add-on is opened with View Source in the Sent folder
- **THEN** it has an `In-Reply-To` header with the parent's single Message-ID
- **AND** it contains a part with `Content-Type: text/vnd.google.email-reaction+json`
  and no `Content-Disposition: attachment`
- **AND** its text/plain alternative contains the emoji and no `cid:` link
