import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ModelConfig } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/model-config.js";
import { isMonkProviderCurrent, loadMonkConfig, saveMonkConfig, syncPiModelsJson } from "../src/config.ts";
import { MONK_BASE_URL, MONK_MODEL_IDS } from "../src/constants.ts";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "monk-pi-"));
}

test("sync writes a schema-valid OpenAI provider with all four combos", async () => {
  const root = tempRoot();
  process.env.MONK_PI_HOME = path.join(root, "monk");
  process.env.PI_CODING_AGENT_DIR = path.join(root, "pi");

  saveMonkConfig({ apiKey: "sk-monk-test", defaultModel: "monk-free" });
  assert.equal(loadMonkConfig().defaultModel, "monk-free");

  const existingModels = path.join(process.env.PI_CODING_AGENT_DIR, "models.json");
  fs.mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
  fs.writeFileSync(
    existingModels,
    JSON.stringify({ providers: { other: { name: "Other", baseUrl: "https://example.test/v1" } } })
  );

  const synced = syncPiModelsJson("sk-monk-test");
  assert.equal(synced.success, true);

  const written = JSON.parse(fs.readFileSync(synced.path, "utf-8")) as {
    providers: { monk: unknown; other?: { name?: string } };
  };
  assert.equal(written.providers.other?.name, "Other");
  assert.equal(isMonkProviderCurrent(written.providers.monk), true);

  const monk = written.providers.monk as {
    api: string;
    baseUrl: string;
    apiKey: string;
    models: Array<{ id: string; input: string[] }>;
  };
  assert.equal(monk.api, "openai-completions");
  assert.equal(monk.baseUrl, MONK_BASE_URL);
  assert.equal(monk.apiKey, "sk-monk-test");
  assert.deepEqual(
    monk.models.map((model) => model.id),
    [...MONK_MODEL_IDS]
  );
  assert.ok(monk.models.every((model) => model.input.includes("image")));

  const loaded = await ModelConfig.load(synced.path);
  assert.equal(loaded.getError(), undefined);
  assert.ok(loaded.getProvider("monk"));
});

test("stale provider blocks are detected", () => {
  assert.equal(
    isMonkProviderCurrent({
      api: "anthropic-messages",
      baseUrl: MONK_BASE_URL,
      compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
      models: MONK_MODEL_IDS.map((id) => ({ id, input: ["text", "image"] })),
    }),
    false
  );
  assert.equal(
    isMonkProviderCurrent({
      api: "openai-completions",
      baseUrl: MONK_BASE_URL,
      compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
      models: [{ id: "monk", input: ["text"] }],
    }),
    false
  );
});
