## ADDED Requirements

### Requirement: React button and emoji picker
The add-on SHALL provide a message-header action titled "React". Its popup SHALL offer a fixed
set of emoji: 👍 ❤️ 😂 😮 😢 🙏 🎉 👀. Each emoji SHALL be a keyboard-focusable button with an
accessible label.

#### Scenario: Picker opens
- **WHEN** the user clicks "React" on a displayed message
- **THEN** a popup shows the eight emoji buttons

### Requirement: Send flow
When the user picks an emoji, the add-on SHALL:
1. evaluate eligibility;
2. open the reaction reply;
3. apply the encryption guard;
4. send the reply immediately with `compose.sendMessage(tab, {mode: "sendNow"})`, unless
   "review before sending" is enabled.

If "review before sending" is enabled, the add-on SHALL leave the compose window open and
unsent.

#### Scenario: Default auto-send
- **WHEN** an eligible message is displayed, the setting is off, and the user picks 👍
- **THEN** a reaction reply is sent without further user action
- **AND** the popup closes

#### Scenario: Review before sending
- **WHEN** the setting is on and the user picks 👍
- **THEN** a compose window containing the reaction reply is left open
- **AND** nothing is sent

#### Scenario: Ineligible message
- **WHEN** the displayed message is not eligible
- **THEN** no compose window opens
- **AND** the popup shows the eligibility reason

### Requirement: Encryption guard
If the opened reaction reply has body encryption enabled, the add-on SHALL NOT send it, SHALL
close that compose window, and SHALL tell the user that reactions cannot be sent encrypted. The
add-on SHALL NOT change the user's encryption settings.

#### Scenario: Encryption on by default for the identity
- **WHEN** the reply opens with OpenPGP or S/MIME body encryption enabled
- **THEN** the compose window is closed without sending
- **AND** the user is notified

### Requirement: Failure reporting
Every refusal or failure SHALL be reported to the user:
- while the popup is open, in the popup;
- after the popup has closed, through a system notification.

This covers eligibility, validation, encryption, compose or send errors. The reports SHALL NOT
include message content beyond the emoji.

Every failure result SHALL carry a `stage`:
- `"precheck"`: before any compose window opens. Shown in the popup.
- `"compose"`: after the compose window opened. Reported by notification.

#### Scenario: Precheck failure stays in the popup
- **WHEN** eligibility refuses the message
- **THEN** the result has `stage: "precheck"`
- **AND** no notification is created

#### Scenario: Send fails after popup closed
- **WHEN** `compose.sendMessage` rejects (for example, an SMTP error)
- **THEN** the result has `stage: "compose"`
- **AND** a notification states that the reaction was not sent, with the error text

### Requirement: Review-before-sending option
The add-on SHALL provide an options page with one checkbox, "Review before sending", stored in
`storage.local`. The default SHALL be off.

#### Scenario: Setting persists
- **WHEN** the user enables the checkbox and restarts Thunderbird
- **THEN** the checkbox is still enabled
- **AND** reactions open for review
