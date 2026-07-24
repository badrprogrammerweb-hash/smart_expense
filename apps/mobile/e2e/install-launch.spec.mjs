import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");

test("native shell has a locally bundled launch page and no remote server URL", async () => {
  const [config, launchPage] = await Promise.all([
    readFile(resolve(mobileRoot, "capacitor.config.ts"), "utf8"),
    access(resolve(mobileRoot, "www", "index.html")),
  ]);

  assert.match(config, /webDir:\s*"www"/);
  assert.doesNotMatch(config, /server\s*:\s*\{[^}]*url/s);
  assert.ok(launchPage === undefined);
});
