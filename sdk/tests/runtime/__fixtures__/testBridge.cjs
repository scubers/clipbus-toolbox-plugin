// Minimal host-verb bridge fixture for duplex protocol testing.
// Mirrors the verbRequest/verbResponse protocol from PluginRuntimeNodeBridgeTemplate.
"use strict";
const readline = require("readline");

process.on("unhandledRejection", (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write("[pasty-bridge] Unhandled rejection: " + msg + "\n");
  process.exit(1);
});

const pendingVerbRequests = new Map();
let verbRequestCounter = 0;

function callHostVerb(verb, args) {
  return new Promise((resolve, reject) => {
    const id = "vrb-" + (++verbRequestCounter);
    pendingVerbRequests.set(id, { resolve, reject });
    process.stdout.write(JSON.stringify({ kind: "verbRequest", id, verb, args: args || {} }) + "\n");
  });
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", async (line) => {
  if (!line) return;
  try {
    const frame = JSON.parse(line);
    if (frame.kind === "verbResponse") {
      const pending = pendingVerbRequests.get(frame.id);
      if (pending) {
        pendingVerbRequests.delete(frame.id);
        if (frame.ok) { pending.resolve(frame.payload); }
        else { pending.reject(new Error(frame.error || "verb request failed")); }
      }
      return;
    }
    if (frame.kind === "invoke") {
      // Exercise the materializeImagePath → verbRequest → verbResponse round-trip.
      const imagePath = await callHostVerb("item.materializeImagePath", {});
      process.stdout.write(JSON.stringify({ kind: "complete", result: { path: imagePath }, operations: [], errorMessage: null }) + "\n");
      return;
    }
    process.stdout.write(JSON.stringify({ kind: "complete", result: null, operations: [], errorMessage: "unknown frame kind" }) + "\n");
  } catch (err) {
    process.stdout.write(JSON.stringify({ kind: "complete", result: null, operations: [], errorMessage: String(err.message) }) + "\n");
  }
});
