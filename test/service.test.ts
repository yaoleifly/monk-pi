import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DEFAULT_MONK_MODEL,
  MONK_ACCOUNT_URL,
  MONK_BASE_URL,
  MONK_MODEL_IDS,
  MONK_MODELS,
  MONK_PI_VERSION,
  isMonkApiKeyShape,
  matchMonkModel,
} from "../src/constants.ts";
import { isMonkContextOverflow } from "../src/extension/monk-extension.ts";
import { compareVersions } from "../src/semver.ts";

test("catalog matches the current Monk combos", () => {
  assert.deepEqual(MONK_MODEL_IDS, ["monk-coding", "monk-fast", "monk", "monk-free"]);
  assert.equal(DEFAULT_MONK_MODEL, "monk-coding");
  assert.equal(MONK_BASE_URL, "https://monk.party/v1");
  assert.equal(MONK_ACCOUNT_URL, "https://monk.party/account/");
  for (const model of MONK_MODELS) {
    assert.equal(model.contextWindow, 1_000_000);
    assert.equal(model.maxTokens, 64_000);
  }
});

test("version constant matches package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  };
  assert.equal(pkg.version, MONK_PI_VERSION);
  assert.equal(pkg.version, "0.13.0");
});

test("model matching accepts ids and unique suffixes", () => {
  assert.equal(matchMonkModel("monk-free")?.id, "monk-free");
  assert.equal(matchMonkModel("FAST")?.id, "monk-fast");
  assert.equal(matchMonkModel("monk")?.id, "monk");
  assert.equal(matchMonkModel("coding")?.id, "monk-coding");
  assert.equal(matchMonkModel("g"), undefined);
  assert.equal(matchMonkModel(""), undefined);
});

test("paid keys use the sk-monk- prefix", () => {
  assert.equal(isMonkApiKeyShape("sk-monk-abc"), true);
  assert.equal(isMonkApiKeyShape(" sk-monk-abc "), true);
  assert.equal(isMonkApiKeyShape("sk-abc"), false);
  assert.equal(isMonkApiKeyShape("sk-ant-xxx"), false);
});

test("version comparison ignores a leading v", () => {
  assert.equal(compareVersions("0.13.0", "0.12.0"), 1);
  assert.equal(compareVersions("v22.14.0", "22.19.0"), -1);
  assert.equal(compareVersions("22.19.0", "22.19.0"), 0);
  assert.equal(compareVersions("1.2.0", "1.2"), 0);
});

test("overflow recovery ignores rate limits", () => {
  assert.equal(isMonkContextOverflow("prompt is too long: 200000 tokens > 100000 maximum"), true);
  assert.equal(isMonkContextOverflow("Range of input length should be [1, 1000000]"), true);
  assert.equal(isMonkContextOverflow("HTTP 429 Too Many Requests. Retry-After: 8"), false);
  assert.equal(isMonkContextOverflow("rate limit exceeded"), false);
  assert.equal(isMonkContextOverflow("context_length_exceeded: already normalized"), false);
});

test("docs stay aligned with the live service", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf-8");
  assert.match(readme, /monk-free/);
  assert.match(readme, /openai-completions/);
  assert.match(readme, /¥30/);
  assert.match(readme, /\$5/);
  assert.match(readme, /教育邮箱 9 折/);
  assert.match(readme, /https:\/\/monk\.party\/account\//);
  assert.match(readme, /22\.19/);
  assert.match(readme, /openai-completions/);
  assert.doesNotMatch(readme, /tree\.ssgoo\.net/);
  assert.doesNotMatch(readme, /baseUrl": "https:\/\/monk\.party\/anthropic/);
  const extension = fs.readFileSync(
    new URL("../src/extension/monk-extension.ts", import.meta.url),
    "utf-8"
  );
  for (const id of MONK_MODEL_IDS) {
    assert.match(extension, new RegExp(`id: "${id}"`));
  }
});
