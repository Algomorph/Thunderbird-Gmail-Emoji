import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPayload,
  buildReactionBody,
  isSingleEmoji,
  REPLY_DETAILS_BASE,
} from "../src/lib/reaction.js";

const DATA_PREFIX = 'href="data:text/vnd.google.email-reaction+json;base64,';

test("thumbs-up payload is the exact escaped ASCII string", () => {
  assert.equal(buildPayload("👍"), '{"version":1,"emoji":"\\ud83d\\udc4d"}');
});

test("multi-code-point emoji round-trips through an ASCII payload", () => {
  const payload = buildPayload("❤️");
  assert.match(payload, /^[\x00-\x7f]*$/);
  const parsed = JSON.parse(payload);
  assert.equal(parsed.emoji, "❤️");
  assert.equal(parsed.version, 1);
  assert.equal(typeof parsed.version, "number");
});

test("valid emoji are accepted", () => {
  for (const e of ["👍", "❤️", "👍🏽", "🧑‍💻"]) {
    assert.ok(isSingleEmoji(e), e);
  }
});

test("invalid input is rejected and cannot build a body", () => {
  for (const s of ["", "a", "👍👍", "👍 ", ":)", undefined, null, 42]) {
    assert.equal(isSingleEmoji(s), false, String(s));
    assert.throws(() => buildReactionBody(s), String(s));
  }
});

test("reaction body carries the fallback and exactly one reaction data URL", () => {
  const body = buildReactionBody("👍");
  assert.ok(body.includes("<p>👍</p>"));
  assert.equal(body.split(DATA_PREFIX).length - 1, 1);
  assert.equal(body.split("data:").length - 1, 1, "no other data: URLs");
  const b64 = body.split(DATA_PREFIX)[1].split('"')[0];
  assert.equal(atob(b64), buildPayload("👍"));
  assert.ok(!body.includes("filename="));
  // Keeps Thunderbird from printing "<cid:...>" into the text/plain alternative.
  assert.ok(body.includes('<a class="moz-txt-link-freetext" href="data:'));
  assert.ok(!body.includes("blockquote"), "no quoted original");
});

test("reply details base forces HTML and dual delivery", () => {
  assert.deepEqual({ ...REPLY_DETAILS_BASE }, { isPlainText: false, deliveryFormat: "both" });
});
