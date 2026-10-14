import assert from "node:assert/strict";
import test from "node:test";
import { extractFirstJson, validateApiKey } from "../src/monk-api.ts";

test("extracts JSON glued to an SSE done frame", () => {
  const payload = extractFirstJson(
    'data: {"choices":[{"message":{"content":"pong"}}]}\n\ndata: [DONE]\n'
  );
  assert.equal(payload.choices?.[0]?.message?.content, "pong");
});

test("validateApiKey does not call the network for an empty key", async () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("network should not be used");
  }) as typeof fetch;
  try {
    const result = await validateApiKey("   ");
    assert.equal(result.valid, false);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("validateApiKey reads combo ids from a mocked /models response", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    assert.match(String(input), /https:\/\/monk\.party\/v1\/models$/);
    return new Response(JSON.stringify({ data: [{ id: "monk" }, { id: "monk-free" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const result = await validateApiKey("sk-monk-test");
    assert.equal(result.valid, true);
    assert.deepEqual(result.models, ["monk", "monk-free"]);
  } finally {
    globalThis.fetch = original;
  }
});
