// Pasty - Copyright (c) 2026. MIT License.
// Duplex protocol test: verbRequest → verbResponse round-trip through the bridge.
// Uses a minimal fixture bridge (testBridge.cjs) that mirrors the real bridge protocol
// to verify frame shapes and promise resolution without spawning a full plugin process.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const bridgePath = path.resolve(__dirname, "__fixtures__/testBridge.cjs");
const exitBridgePath = path.resolve(__dirname, "__fixtures__/testBridgeExit.cjs");

/** Poll `liveFrames` until `predicate` matches or timeout is reached. */
async function waitForFrame(liveFrames, predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = liveFrames.find(predicate);
    if (frame) return frame;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Timed out waiting for frame matching predicate");
}

function runDuplex(bridgeScript, writeFrames, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [bridgeScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const frames = [];
    let buf = "";

    proc.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (line.trim()) {
          try { frames.push(JSON.parse(line)); }
          catch { frames.push({ _raw: line }); }
        }
      }
    });

    const stderrLines = [];
    proc.stderr.on("data", (chunk) => {
      stderrLines.push(chunk.toString("utf8"));
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("duplex test timed out"));
    }, timeoutMs);

    proc.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ frames, exitCode: code, stderr: stderrLines.join("") });
    });

    writeFrames(proc.stdin, frames).catch((err) => {
      proc.kill();
      reject(err);
    });
  });
}

/** Convenience wrapper using the default test bridge. */
function run(writeFrames, timeoutMs) {
  return runDuplex(bridgePath, writeFrames, timeoutMs);
}

test("bridge emits verbRequest frame when invoke triggers materializeImagePath", async () => {
  const { frames } = await run(async (stdin, liveFrames) => {
    stdin.write(JSON.stringify({ kind: "invoke" }) + "\n");
    const verbReq = await waitForFrame(liveFrames, (f) => f.kind === "verbRequest");
    stdin.write(JSON.stringify({ kind: "verbResponse", id: verbReq.id, ok: true, payload: "/tmp/materialized.png" }) + "\n");
    stdin.end();
  });

  const verbReq = frames.find((f) => f.kind === "verbRequest");
  assert.ok(verbReq, "bridge must emit a verbRequest frame");
  assert.equal(verbReq.verb, "item.materializeImagePath", "verb must be item.materializeImagePath");
  assert.ok(typeof verbReq.id === "string" && verbReq.id.length > 0, "verbRequest must have an id");
  assert.deepEqual(verbReq.args, {}, "materializeImagePath args must be empty");
});

test("verbResponse with ok:true resolves to the payload and complete frame carries result", async () => {
  const expectedPath = "/tmp/test-image-123.png";

  const { frames } = await run(async (stdin, liveFrames) => {
    stdin.write(JSON.stringify({ kind: "invoke" }) + "\n");
    const verbReq = await waitForFrame(liveFrames, (f) => f.kind === "verbRequest");
    stdin.write(JSON.stringify({ kind: "verbResponse", id: verbReq.id, ok: true, payload: expectedPath }) + "\n");
    stdin.end();
  });

  const complete = frames.find((f) => f.kind === "complete");
  assert.ok(complete, "bridge must emit a complete frame after verbResponse");
  assert.equal(complete.errorMessage, null, "complete frame must have no errorMessage");
  assert.equal(complete.result?.path, expectedPath, "complete frame result must contain the path from verbResponse");
});

test("verbResponse with ok:false causes complete frame to carry errorMessage", async () => {
  const { frames } = await run(async (stdin, liveFrames) => {
    stdin.write(JSON.stringify({ kind: "invoke" }) + "\n");
    await waitForFrame(liveFrames, (f) => f.kind === "verbRequest");
    stdin.write(JSON.stringify({ kind: "verbResponse", id: "vrb-1", ok: false, error: "item is not an image" }) + "\n");
    stdin.end();
  });

  const complete = frames.find((f) => f.kind === "complete");
  assert.ok(complete, "bridge must emit a complete frame");
  assert.ok(
    complete.errorMessage?.includes("item is not an image"),
    `complete.errorMessage must propagate verb error, got: ${complete.errorMessage}`
  );
});

test("verbResponse with unrecognised id is silently ignored — bridge does not crash", async () => {
  const { frames } = await run(async (stdin, liveFrames) => {
    stdin.write(JSON.stringify({ kind: "invoke" }) + "\n");
    const verbReq = await waitForFrame(liveFrames, (f) => f.kind === "verbRequest");
    // Send unknown id first — must be silently dropped.
    stdin.write(JSON.stringify({ kind: "verbResponse", id: "unknown-id", ok: true, payload: "/tmp/wrong.png" }) + "\n");
    // Then send the correct id to resolve the pending promise.
    stdin.write(JSON.stringify({ kind: "verbResponse", id: verbReq.id, ok: true, payload: "/tmp/real.png" }) + "\n");
    stdin.end();
  });

  const complete = frames.find((f) => f.kind === "complete");
  assert.ok(complete, "bridge must still emit a complete frame");
  assert.equal(complete.result?.path, "/tmp/real.png", "result must use the correct verbResponse payload");
});

test("unhandled rejection causes bridge to exit with non-zero code and no complete frame", async () => {
  // Uses a separate fixture that triggers an unhandled rejection on invoke.
  const { frames, exitCode, stderr } = await runDuplex(
    exitBridgePath,
    async (stdin) => {
      stdin.write(JSON.stringify({ kind: "invoke" }) + "\n");
      stdin.end();
    }
  );

  const complete = frames.find((f) => f.kind === "complete");
  assert.ok(!complete, "bridge must NOT emit a complete frame on unhandled rejection");
  assert.notEqual(exitCode, 0, "bridge must exit with non-zero code on unhandled rejection");
  assert.ok(stderr.includes("Unhandled rejection"), `stderr must mention the rejection, got: ${stderr}`);
});
