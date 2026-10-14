import assert from "node:assert/strict";
import test from "node:test";
import { resolvePiBinary } from "../src/pi-runner.ts";

test("the bundled Pi 1.2 runtime can be launched", () => {
  const resolved = resolvePiBinary();
  assert.notEqual(resolved.type, "missing");
  assert.match(resolved.version ?? "", /^1\.2\./);
});
