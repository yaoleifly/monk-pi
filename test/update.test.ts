import assert from "node:assert/strict";
import test from "node:test";
import { classifyInstallPath, updateCommand } from "../src/commands/update.ts";

test("classifies install locations", () => {
  assert.equal(classifyInstallPath("/Users/a/.npm/_npx/abc/node_modules/monk-pi/dist/cli.js"), "npx");
  assert.equal(
    classifyInstallPath("/opt/homebrew/Cellar/monk-pi/0.13.0/bin/monk-pi"),
    "brew"
  );
  assert.equal(classifyInstallPath("/home/a/.bun/install/global/node_modules/monk-pi/dist/cli.js"), "bun");
  assert.equal(
    classifyInstallPath("/usr/lib/node_modules/monk-pi/dist/cli.js", { cwd: "/workspace" }),
    "npm"
  );
  assert.equal(
    classifyInstallPath("/workspace/node_modules/monk-pi/dist/cli.js", { cwd: "/workspace" }),
    "local"
  );
  assert.equal(classifyInstallPath("/workspace/dist/cli.js", { cwd: "/workspace" }), "local");
});

test("does not downgrade a newer local checkout", async () => {
  let upgraded = false;
  const code = await updateCommand(true, {
    location: { channel: "npm", scriptPath: "/usr/lib/node_modules/monk-pi/dist/cli.js" },
    latest: "0.1.0",
    runUpgrade: () => {
      upgraded = true;
      return 0;
    },
  });
  assert.equal(code, 0);
  assert.equal(upgraded, false);
});

test("local checkouts print instructions instead of installing globally", async () => {
  let upgraded = false;
  const code = await updateCommand(false, {
    location: { channel: "local", scriptPath: "/workspace/dist/cli.js" },
    latest: "9.9.9",
    runUpgrade: () => {
      upgraded = true;
      return 0;
    },
  });
  assert.equal(code, 0);
  assert.equal(upgraded, false);
});

test("npm installs run the global upgrade command", async () => {
  const calls: string[] = [];
  const code = await updateCommand(false, {
    location: { channel: "npm", scriptPath: "/usr/lib/node_modules/monk-pi/dist/cli.js" },
    latest: "9.9.9",
    runUpgrade: (cmd, args) => {
      calls.push(`${cmd} ${args.join(" ")}`);
      return 0;
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(calls, ["npm install -g monk-pi@latest"]);
});
