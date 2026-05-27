import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const rendererDir = "dist/ui/renderers/decode-renderer";
const rendererHTMLPath = path.resolve(projectRoot, rendererDir, "index.html");
const rendererJSPath = path.resolve(projectRoot, rendererDir, "index.js");
const rendererCSSPath = path.resolve(projectRoot, rendererDir, "index.css");
const runtimeEntryPath = path.resolve(projectRoot, "dist/plugin.cjs");

const rendererHTML = await readFile(rendererHTMLPath, "utf8");
await readFile(rendererJSPath, "utf8");
await readFile(rendererCSSPath, "utf8");
const runtimeEntry = await readFile(runtimeEntryPath, "utf8");

if (!rendererHTML.includes("./index.js") || !rendererHTML.includes("./index.css")) {
  throw new Error("decode renderer HTML must reference page-local built assets.");
}

if (rendererHTML.includes('src="/') || rendererHTML.includes('href="/')) {
  throw new Error("decode renderer HTML must not contain absolute local asset references.");
}

if (
  !runtimeEntry.includes("definePlugin") ||
  !runtimeEntry.includes("decode-detector") ||
  !runtimeEntry.includes("decode-renderer")
) {
  throw new Error("dist/plugin.cjs does not contain the required decode runtime bundles.");
}

console.log("Build verification passed.");
