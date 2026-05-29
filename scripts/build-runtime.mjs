import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.resolve(projectRoot, "dist");

await mkdir(outputDirectory, { recursive: true });

await build({
  absWorkingDir: projectRoot,
  entryPoints: [path.resolve(projectRoot, "src/plugin.ts")],
  outfile: path.resolve(outputDirectory, "plugin.cjs"),
  bundle: true,
  // sharp ships prebuilt native (.node) binaries that esbuild cannot bundle.
  // Keep it external so the runtime require()s it from the host's node_modules
  // (populated by scripts/install.mjs `npm install`). All other deps inline.
  external: ["sharp"],
  format: "cjs",
  platform: "node",
  target: "node18",
  logLevel: "info",
  // Unwrap `export default` (which esbuild emits as `module.exports.default = …`)
  // into the bare `module.exports = …` the host bridge require()s. We can't use
  // TS `export =` in the entry because runtime tests load the .ts source via
  // Node's --experimental-strip-types, which rejects that syntax.
  footer: { js: "if (typeof module.exports.default !== 'undefined') module.exports = module.exports.default;" }
});
