import { build } from "vite";
import { cp, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const featuresDir = path.resolve(projectRoot, "src/features");
const uiOutputRoot = path.resolve(projectRoot, "dist/ui");

function pascalCase(slug) {
  return slug.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

async function hasEntryFiles(dir) {
  try {
    await stat(path.join(dir, "main.ts"));
    await stat(path.join(dir, "index.html"));
    return true;
  } catch {
    return false;
  }
}

// Each src/features/<name>/ that ships main.ts + index.html is one UI bundle.
// The directory name IS the manifest renderer/action id (e.g. decode-renderer →
// dist/ui/renderers/decode-renderer). Names ending in "-renderer" are attachment
// renderers; everything else is treated as an action UI.
async function discoverPages() {
  const pages = [];
  const topLevel = await readdir(featuresDir, { withFileTypes: true });
  for (const dirent of topLevel) {
    if (!dirent.isDirectory()) continue;
    const featureName = dirent.name;
    const featurePath = path.join(featuresDir, featureName);
    if (!(await hasEntryFiles(featurePath))) continue;
    const kind = featureName.endsWith("-renderer") ? "renderers" : "actions";
    pages.push({
      name: featureName,
      kind,
      globalName: `PastyPlugin${pascalCase(featureName)}`,
      entry: path.join(featurePath, "main.ts"),
      template: path.join(featurePath, "index.html"),
    });
  }
  return pages;
}

const pages = await discoverPages();

await rm(uiOutputRoot, { recursive: true, force: true });

for (const page of pages) {
  const outDir = path.resolve(uiOutputRoot, page.kind, page.name);
  await build({
    root: projectRoot,
    configFile: false,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [vue()],
    build: {
      lib: { entry: page.entry, name: page.globalName, formats: ["iife"], fileName: () => "index.js", cssFileName: "index" },
      outDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsDir: ".",
      rollupOptions: {
        output: { assetFileNames: (asset) => asset.name?.endsWith(".css") ? "index.css" : "[name][extname]" }
      }
    }
  });
  await cp(page.template, path.resolve(outDir, "index.html"));
}
