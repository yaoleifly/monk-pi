import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env, MONK_PI_HOME: path.join(root, ".monk-pi-test-home") },
  });
}

test("version flag prints 0.13.0", () => {
  const result = runCli(["--version"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /monk-pi v0\.13\.0/);
});

test("help lists the four combos and omits the retired demo", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /monk-free/);
  assert.match(result.stdout, /monk-coding/);
  assert.match(result.stdout, /https:\/\/monk\.party\/account\//);
  assert.doesNotMatch(result.stdout, /tree\.ssgoo\.net/);
});

test("unknown model names are rejected", () => {
  const result = runCli(["model", "gpt-4o"]);
  assert.match(`${result.stdout}\n${result.stderr}`, /未知模型/);
  assert.match(`${result.stdout}\n${result.stderr}`, /monk-free/);
});
