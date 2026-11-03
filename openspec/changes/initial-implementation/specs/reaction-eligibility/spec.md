## ADDED Requirements

### Requirement: Eligibility decision
Before opening a reply, the add-on SHALL decide whether the displayed message may receive a
reaction. The decision SHALL be either `{ok: true, identityId}` or `{ok: false, reason}`,
where `reason` is a short user-facing sentence. Rules SHALL be evaluated in the order listed
below, and the first failure SHALL determine the reason:
1. exactly one displayed message;
2. Message-ID required;
3. no mailing-list messages;
4. no encrypted originals;
5. no custom Reply-To;
6. recipient limit;
7. user is a direct recipient.

Gmail also refuses reactions to mail received through an alias. Thunderbird cannot tell an
alias from an identity, so that case is out of scope: such a reaction degrades to a normal
reply.

#### Scenario: Ordinary direct message is eligible
- **WHEN** a message has a Message-ID, no list headers, is not encrypted, has no Reply-To, has
  3 distinct To+CC recipients, and the user's identity address is among them
- **THEN** the decision is `{ok: true, identityId}` with that identity's id

#### Scenario: First failing rule wins
- **WHEN** a message both has a `List-Id` header and has 25 recipients
- **THEN** the reason is the mailing-list reason

### Requirement: Exactly one displayed message
The add-on SHALL refuse unless exactly one message is displayed. (In practice Thunderbird hides
the message-header action for a multi-message selection, so this check is a defensive
fallback.)

#### Scenario: Multiple messages selected
- **WHEN** the message pane shows a multi-message summary
- **THEN** the decision is not ok
- **AND** the reason asks the user to select a single message

### Requirement: Message-ID required
The add-on SHALL refuse a message whose Message-ID header is missing or empty.

#### Scenario: No Message-ID
- **WHEN** the message has an empty `headerMessageId`
- **THEN** the decision is not ok

### Requirement: No reactions to mailing-list messages
The add-on SHALL refuse a message that has any of the headers `List-Id`, `List-Post` or
`List-Unsubscribe`, or a `Precedence` header of `list` or `bulk` (case-insensitive).

#### Scenario: Google Group message
- **WHEN** the message has a `List-Id` header
- **THEN** the decision is not ok
- **AND** the reason mentions mailing lists

#### Scenario: Bulk precedence
- **WHEN** the message has `Precedence: Bulk`
- **THEN** the decision is not ok

### Requirement: Recipient limit
The add-on SHALL refuse a message with more than 20 distinct addresses across To and CC.
Distinctness SHALL be determined case-insensitively on the addr-spec, ignoring display names.

#### Scenario: Twenty recipients allowed
- **WHEN** To+CC contain 20 distinct addresses, and the user's address is one of them
- **THEN** the recipient-limit rule passes

#### Scenario: Twenty-one recipients refused
- **WHEN** To+CC contain 21 distinct addresses
- **THEN** the decision is not ok

#### Scenario: Duplicates and display names collapse
- **WHEN** To has `"Ann <ANN@x.com>"` and CC has `ann@x.com`
- **THEN** they count as one address

### Requirement: No reactions to encrypted originals
The add-on SHALL refuse a message whose top-level Content-Type is `multipart/encrypted` or
`application/pkcs7-mime` (case-insensitive). Gmail does not offer reactions on encrypted
messages, and the reply would expose that a reaction was sent.

#### Scenario: OpenPGP-encrypted original
- **WHEN** the message's Content-Type is `multipart/encrypted; protocol="application/pgp-encrypted"`
- **THEN** the decision is not ok

### Requirement: No reactions when the sender set a custom Reply-To
The add-on SHALL refuse a message that has a `Reply-To` header containing any address that
differs from the `From` address (addr-spec, case-insensitive). The reply would not go to the
sender, and Gmail does not offer reactions in that case.

#### Scenario: Reply-To differs from From
- **WHEN** From is `ann@x.com` and Reply-To is `support@x.com`
- **THEN** the decision is not ok

#### Scenario: Reply-To equal to From
- **WHEN** From is `Ann <ann@x.com>` and Reply-To is `ANN@x.com`
- **THEN** this rule passes

### Requirement: User must be a direct recipient
The add-on SHALL refuse unless at least one of the user's identity email addresses (from all
accounts) appears in To or CC, compared case-insensitively on the addr-spec.

When the decision is ok, it SHALL include `identityId`, the id of the matching identity, chosen
as follows:
1. Prefer a matching identity of the account that owns the message's folder.
2. Otherwise, use the first matching identity in `accounts.list()` order.

#### Scenario: User only in BCC
- **WHEN** none of the user's identity addresses appear in To or CC
- **THEN** the decision is not ok
- **AND** the reason says the user is not a direct recipient

#### Scenario: Identity of the owning account preferred
- **WHEN** identities of accounts A and B both match To/CC
- **AND** the message lives in a folder of account B
- **THEN** the decision is ok with B's matching identity id
