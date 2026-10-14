import assert from "node:assert/strict";
import test from "node:test";
import {
  autoFixCommand,
  buildAutoFixPrompt,
  formatDuration,
  resolveShellCommand,
  runWatchedCommand,
} from "../src/commands/auto-fix.ts";

test("help does not execute a shell command", async () => {
  const code = await autoFixCommand(["--help"], {
    run: async () => {
      throw new Error("should not run");
    },
  });
  assert.equal(code, 0);
});

test("joins a monitored command", () => {
  assert.equal(resolveShellCommand(["npm", "run", "build"]), "npm run build");
  assert.equal(resolveShellCommand(["npm test"]), "npm test");
  assert.equal(resolveShellCommand(["  "]), "");
});

test("formats short durations the way the wizard prints them", () => {
  assert.equal(formatDuration(2400), "2.4s");
  assert.equal(formatDuration(80), "80ms");
});

test("auto-fix prompt keeps the original command", () => {
  const prompt = buildAutoFixPrompt({
    command: "npm test",
    exitCode: 1,
    durationMs: 2400,
    output: "FAIL src/auth.test.ts",
  });
  assert.match(prompt, /npm test/);
  assert.match(prompt, /退出码: 1/);
  assert.match(prompt, /FAIL src\/auth\.test\.ts/);
});

test("successful commands skip the wizard", async () => {
  let launched = false;
  const code = await autoFixCommand(["node", "-e", "process.exit(0)"], {
    run: async () => ({ command: "ok", exitCode: 0, durationMs: 5, output: "" }),
    choose: async () => {
      throw new Error("should not prompt");
    },
    launch: async () => {
      launched = true;
      return 0;
    },
  });
  assert.equal(code, 0);
  assert.equal(launched, false);
});

test("fix choice launches print mode with the failure log", async () => {
  const launched: string[][] = [];
  const code = await autoFixCommand(["npm test"], {
    run: async () => ({ command: "npm test", exitCode: 1, durationMs: 10, output: "boom" }),
    choose: async () => "fix",
    prepare: async () => ({ apiKey: "sk-monk-test", defaultModel: "monk-coding" }),
    launch: async (args) => {
      launched.push(args);
      return 0;
    },
  });
  assert.equal(code, 0);
  assert.equal(launched.length, 1);
  assert.equal(launched[0][0], "-p");
  assert.match(launched[0][1], /npm test/);
});

test("ignore choice returns the command exit code", async () => {
  const code = await autoFixCommand(["npm test"], {
    run: async () => ({ command: "npm test", exitCode: 3, durationMs: 10, output: "boom" }),
    choose: async () => "ignore",
    prepare: async () => {
      throw new Error("should not prepare an agent session");
    },
    launch: async () => 0,
  });
  assert.equal(code, 3);
});

test("watched command captures a failing exit code", async () => {
  const result = await runWatchedCommand("node -e \"console.error('nope'); process.exit(4)\"", {
    echo: false,
  });
  assert.equal(result.exitCode, 4);
  assert.match(result.output, /nope/);
});
