import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../src/manifest.json", import.meta.url), "utf8"),
);

test("manifest is MV3 and targets Thunderbird 128+", () => {
  assert.equal(manifest.manifest_version, 3);
  const min = manifest.browser_specific_settings.gecko.strict_min_version;
  assert.ok(parseInt(min, 10) >= 128, `strict_min_version ${min} < 128`);
});
