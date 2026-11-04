import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkEligibility,
  extractAddress,
  parseAddressList,
  REASONS,
} from "../src/lib/eligibility.js";

const ME = { id: "id1", email: "me@gmail.com", accountId: "account1" };

function message(overrides = {}) {
  return {
    headerMessageId: "abc@mail.gmail.com",
    author: "Ann <ann@x.com>",
    recipients: ["Me <me@gmail.com>", "bob@x.com"],
    ccList: ["carol@x.com"],
    ...overrides,
  };
}

function check({ msg = message(), headers = {}, identities = [ME], folderAccountId = "account1", messages } = {}) {
  return checkEligibility({ messages: messages ?? [msg], headers, identities, folderAccountId });
}

const addrs = (n) => Array.from({ length: n }, (_, i) => `user${i}@x.com`);

test("ordinary direct message is eligible with the matching identity", () => {
  assert.deepEqual(check({ headers: { from: ["Ann <ann@x.com>"] } }), { ok: true, identityId: "id1" });
});

test("multiple or zero displayed messages are refused", () => {
  assert.deepEqual(check({ messages: [message(), message()] }), { ok: false, reason: REASONS.notSingle });
  assert.equal(check({ messages: [] }).reason, REASONS.notSingle);
});

test("missing Message-ID is refused", () => {
  assert.equal(check({ msg: message({ headerMessageId: "" }) }).reason, REASONS.noMessageId);
});

test("mailing-list headers are refused", () => {
  for (const h of ["list-id", "list-post", "list-unsubscribe"]) {
    assert.equal(check({ headers: { [h]: ["<x>"] } }).reason, REASONS.mailingList, h);
  }
});

test("bulk or list precedence is refused, case-insensitively", () => {
  assert.equal(check({ headers: { precedence: ["Bulk"] } }).reason, REASONS.mailingList);
  assert.equal(check({ headers: { precedence: ["list"] } }).reason, REASONS.mailingList);
  assert.equal(check({ headers: { precedence: ["junk"] } }).ok, true);
});

test("encrypted originals are refused", () => {
  const pgp = 'multipart/encrypted; protocol="application/pgp-encrypted"; boundary="b"';
  assert.equal(check({ headers: { "content-type": [pgp] } }).reason, REASONS.encrypted);
  const smime = "application/pkcs7-mime; smime-type=enveloped-data; name=smime.p7m";
  assert.equal(check({ headers: { "content-type": [smime] } }).reason, REASONS.encrypted);
  assert.equal(check({ headers: { "content-type": ["multipart/alternative; boundary=b"] } }).ok, true);
});

test("a Reply-To that differs from From is refused", () => {
  const headers = { from: ["ann@x.com"], "reply-to": ["support@x.com"] };
  assert.equal(check({ headers }).reason, REASONS.replyTo);
});

test("a Reply-To equal to From passes", () => {
  const headers = { from: ["Ann <ann@x.com>"], "reply-to": ["ANN@x.com"] };
  assert.equal(check({ headers }).ok, true);
});

test("Reply-To falls back to the message author when there is no From header", () => {
  assert.equal(check({ headers: { "reply-to": ["ann@x.com"] } }).ok, true);
  assert.equal(check({ headers: { "reply-to": ["other@x.com"] } }).reason, REASONS.replyTo);
});

test("twenty distinct recipients are allowed", () => {
  const msg = message({ recipients: ["me@gmail.com", ...addrs(19)], ccList: [] });
  assert.equal(check({ msg }).ok, true);
});

test("twenty-one distinct recipients are refused", () => {
  const msg = message({ recipients: ["me@gmail.com", ...addrs(10)], ccList: addrs(20).slice(10) });
  assert.equal(check({ msg }).reason, REASONS.tooManyRecipients);
});

test("duplicates and display names collapse to one address", () => {
  // To: me + "Ann <ANN@x.com>" + 18 others; CC: ann@x.com again. That is 20 distinct
  // addresses, or 21 (refused) if the two Ann entries were counted separately.
  const msg = message({
    recipients: ["me@gmail.com", "Ann <ANN@x.com>", ...addrs(18)],
    ccList: ["ann@x.com"],
  });
  assert.equal(check({ msg }).ok, true);
});

test("user only in BCC is refused", () => {
  const msg = message({ recipients: ["bob@x.com"], ccList: [] });
  assert.deepEqual(check({ msg }), { ok: false, reason: REASONS.notDirectRecipient });
});

test("identity of the folder's owning account is preferred", () => {
  const a = { id: "idA", email: "me@gmail.com", accountId: "A" };
  const b = { id: "idB", email: "Me@Gmail.com", accountId: "B" };
  assert.equal(check({ identities: [a, b], folderAccountId: "B" }).identityId, "idB");
  assert.equal(check({ identities: [a, b], folderAccountId: "C" }).identityId, "idA");
});

test("a message addressed to a secondary identity selects that identity", () => {
  const primary = { id: "idA", email: "main@gmail.com", accountId: "A" };
  const secondary = { id: "idB", email: "me@gmail.com", accountId: "A" };
  assert.equal(check({ identities: [primary, secondary], folderAccountId: "A" }).identityId, "idB");
});

test("the first failing rule determines the reason", () => {
  const msg = message({ recipients: addrs(25) });
  assert.equal(check({ msg, headers: { "list-id": ["<g.example.com>"] } }).reason, REASONS.mailingList);
});

test("address parsing handles quoted commas and angle brackets", () => {
  assert.deepEqual(
    parseAddressList('"Doe, John" <J@x.com>, ann@x.com').map(extractAddress),
    ["j@x.com", "ann@x.com"],
  );
  assert.equal(extractAddress("  Bob@X.com "), "bob@x.com");
});
