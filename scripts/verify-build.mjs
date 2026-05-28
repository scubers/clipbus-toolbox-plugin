import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const manifest = JSON.parse(await readFile(path.resolve(projectRoot, "manifest.json"), "utf8"));

const uiRoot = manifest.runtime?.uiRoot;
const nodeEntry = manifest.runtime?.nodeEntry;
if (!uiRoot || !nodeEntry) {
  throw new Error("manifest.runtime must declare uiRoot and nodeEntry.");
}

// Every UI-backed renderer/action must have built page-local assets that the
// HTML references relatively (the host serves each page from its own dir).
const uiContributions = [
  ...(manifest.attachmentRenderers ?? []),
  ...(manifest.actions ?? []),
].filter((entry) => typeof entry.uiEntry === "string" && entry.uiEntry.length > 0);

for (const entry of uiContributions) {
  const htmlPath = path.resolve(projectRoot, uiRoot, entry.uiEntry);
  const pageDir = path.dirname(htmlPath);
  const html = await readFile(htmlPath, "utf8");
  await readFile(path.resolve(pageDir, "index.js"), "utf8");

  if (!html.includes("./index.js")) {
    throw new Error(`${entry.id}: built HTML must reference page-local ./index.js.`);
  }
  if (html.includes("./index.css")) {
    await readFile(path.resolve(pageDir, "index.css"), "utf8");
  }
  if (html.includes('src="/') || html.includes('href="/')) {
    throw new Error(`${entry.id}: built HTML must not contain absolute local asset references.`);
  }
}

// The runtime bundle must call definePlugin and address every manifest id, so a
// missing/misnamed handler registration is caught before shipping.
const runtimeEntry = await readFile(path.resolve(projectRoot, nodeEntry), "utf8");
if (!runtimeEntry.includes("definePlugin")) {
  throw new Error(`runtime bundle ${nodeEntry} must call definePlugin.`);
}

const handlerIds = [
  ...(manifest.attachmentRenderers ?? []),
  ...(manifest.detectors ?? []),
  ...(manifest.actions ?? []),
].map((entry) => entry.id);

for (const id of handlerIds) {
  if (!runtimeEntry.includes(id)) {
    throw new Error(`runtime bundle ${nodeEntry} is missing handler id "${id}".`);
  }
}

console.log(
  `Build verification passed (${uiContributions.length} UI page(s), ${handlerIds.length} handler id(s)).`,
);
