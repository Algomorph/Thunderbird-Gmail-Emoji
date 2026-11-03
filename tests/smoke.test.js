import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../src/manifest.json", import.meta.url), "utf8"),
);

test("manifest is MV3 and targets Thunderbird 128+", () => {
  assert.equal(manifest.manifest_version, 3);
  const min = manifest.browser_specific_settings.gecko.strict_min_version;
  assert.ok(parseInt(min, 10) >= 128, `strict_min_version ${min} < 128`);
});

test("every icon the manifest names exists in src/", () => {
  const paths = [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.message_display_action?.default_icon ?? {}),
  ];
  assert.ok(paths.length > 0, "manifest declares no icons");
  for (const p of paths) {
    assert.ok(existsSync(new URL(`../src/${p}`, import.meta.url)), `missing ${p}`);
  }
});
