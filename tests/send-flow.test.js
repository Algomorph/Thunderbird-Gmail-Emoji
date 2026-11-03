import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRuntimeMessage, react, REASONS } from "../src/lib/send-flow.js";
import { REASONS as ELIGIBILITY } from "../src/lib/eligibility.js";
import { buildReactionBody } from "../src/lib/reaction.js";

// A fake of the Thunderbird `messenger` surface the send flow uses. Every call is
// recorded in `calls` as [name, ...args].
function fakeApi({
  displayed = { id: "list1", messages: [{ id: 7, headerMessageId: "m@x", author: "ann@x.com", recipients: ["me@gmail.com"], ccList: [], folder: { accountId: "acc1" } }] },
  headers = { from: ["ann@x.com"] },
  accounts = [{ id: "acc1", identities: [{ id: "idDefault", email: "main@gmail.com" }, { id: "idMe", email: "me@gmail.com" }] }],
  details = {},
  reviewBeforeSend = false,
  sendError = null,
} = {}) {
  const calls = [];
  const rec = (name, value) => (...args) => {
    calls.push([name, ...args]);
    return typeof value === "function" ? value(...args) : Promise.resolve(value);
  };
  const api = {
    calls,
    messageDisplay: { getDisplayedMessages: rec("getDisplayedMessages", displayed) },
    messages: { getFull: rec("getFull", { headers }) },
    accounts: { list: rec("accountsList", accounts) },
    compose: {
      beginReply: rec("beginReply", { id: 99 }),
      getComposeDetails: rec("getComposeDetails", details),
      setComposeDetails: rec("setComposeDetails", undefined),
      sendMessage: rec("sendMessage", () => (sendError ? Promise.reject(new Error(sendError)) : Promise.resolve({}))),
    },
    tabs: { remove: rec("tabsRemove", undefined) },
    storage: { local: { get: rec("storageGet", { reviewBeforeSend }) } },
    notifications: { create: rec("notify", "n1") },
  };
  return api;
}

const named = (api, name) => api.calls.filter((c) => c[0] === name);

test("reply is opened with replyToAll, HTML, dual delivery, the matched identity and the reaction body", async () => {
  const api = fakeApi();
  assert.deepEqual(await react({ tabId: 1, emoji: "👍" }, api), { ok: true });
  const [[, messageId, replyType, details]] = named(api, "beginReply");
  assert.equal(messageId, 7);
  assert.equal(replyType, "replyToAll");
  assert.deepEqual(details, {
    isPlainText: false,
    deliveryFormat: "both",
    identityId: "idMe", // the secondary identity the message was addressed to, not the default
    body: buildReactionBody("👍"),
  });
});

test("default flow sends immediately", async () => {
  const api = fakeApi();
  await react({ tabId: 1, emoji: "👍" }, api);
  assert.deepEqual(named(api, "sendMessage"), [["sendMessage", 99, { mode: "sendNow" }]]);
});

test("review-before-sending leaves the reply open and unsent", async () => {
  const api = fakeApi({ reviewBeforeSend: true });
  assert.deepEqual(await react({ tabId: 1, emoji: "👍" }, api), { ok: true });
  assert.equal(named(api, "beginReply").length, 1);
  assert.equal(named(api, "sendMessage").length, 0);
  assert.equal(named(api, "tabsRemove").length, 0);
});

test("an ineligible message opens no reply and fails at precheck", async () => {
  const api = fakeApi({ headers: { "list-id": ["<g.example.com>"] } });
  assert.deepEqual(await react({ tabId: 1, emoji: "👍" }, api), {
    ok: false,
    stage: "precheck",
    reason: ELIGIBILITY.mailingList,
  });
  assert.equal(named(api, "beginReply").length, 0);
});

test("an invalid emoji fails at precheck without touching Thunderbird", async () => {
  const api = fakeApi();
  assert.deepEqual(await react({ tabId: 1, emoji: "👍👍" }, api), {
    ok: false,
    stage: "precheck",
    reason: REASONS.invalidEmoji,
  });
  assert.equal(api.calls.length, 0);
});

test("encryption guard closes the reply unsent without changing encryption settings", async () => {
  const api = fakeApi({ details: { selectedEncryptionTechnology: { name: "OpenPGP", encryptBody: true } } });
  assert.deepEqual(await react({ tabId: 1, emoji: "👍" }, api), {
    ok: false,
    stage: "compose",
    reason: REASONS.encrypted,
  });
  assert.equal(named(api, "sendMessage").length, 0);
  assert.deepEqual(named(api, "tabsRemove"), [["tabsRemove", 99]]);
  assert.deepEqual(named(api, "setComposeDetails"), [["setComposeDetails", 99, { isModified: false }]]);
});

test("signing-only replies are still sent", async () => {
  const api = fakeApi({ details: { selectedEncryptionTechnology: { name: "OpenPGP", encryptBody: false, signMessage: true } } });
  assert.deepEqual(await react({ tabId: 1, emoji: "👍" }, api), { ok: true });
  assert.equal(named(api, "sendMessage").length, 1);
});

test("a send failure returns a compose-stage failure with the error text", async () => {
  const api = fakeApi({ sendError: "SMTP 554 rejected" });
  const result = await react({ tabId: 1, emoji: "👍" }, api);
  assert.equal(result.ok, false);
  assert.equal(result.stage, "compose");
  assert.match(result.reason, /SMTP 554 rejected/);
});

test("both getDisplayedMessages shapes are accepted", async () => {
  const msg = { id: 7, headerMessageId: "m@x", author: "ann@x.com", recipients: ["me@gmail.com"], folder: { accountId: "acc1" } };
  for (const displayed of [[msg], { id: "l", messages: [msg] }]) {
    assert.deepEqual(await react({ tabId: 1, emoji: "👍" }, fakeApi({ displayed })), { ok: true });
  }
});

test("background handler notifies only compose-stage failures", async () => {
  const precheck = fakeApi({ displayed: [] });
  const r1 = await handleRuntimeMessage({ type: "react", tabId: 1, emoji: "👍" }, precheck);
  assert.equal(r1.stage, "precheck");
  assert.equal(named(precheck, "notify").length, 0);

  const compose = fakeApi({ sendError: "boom" });
  const r2 = await handleRuntimeMessage({ type: "react", tabId: 1, emoji: "👍" }, compose);
  assert.equal(r2.stage, "compose");
  const [[, options]] = named(compose, "notify");
  assert.equal(options.title, "Reaction not sent");
  assert.match(options.message, /boom/);

  const ok = fakeApi();
  assert.deepEqual(await handleRuntimeMessage({ type: "react", tabId: 1, emoji: "👍" }, ok), { ok: true });
  assert.equal(named(ok, "notify").length, 0);
});

test("background handler ignores unrelated messages", async () => {
  const api = fakeApi();
  assert.equal(await handleRuntimeMessage({ type: "other" }, api), undefined);
  assert.equal(api.calls.length, 0);
});
