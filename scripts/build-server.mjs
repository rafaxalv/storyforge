// Bundles the custom web server, the worker and the migration CLI into dist/.
// Next.js itself and native/runtime libraries stay external (installed in node_modules).
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

await build({
  entryPoints: {
    main: "src/server/main.ts",
    worker: "src/worker.ts",
    migrate: "src/server/db/migrate.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  packages: "external",
  alias: { "@": "./src" },
  define: { "process.env.STORYFORGE_BUILD_VERSION": JSON.stringify(pkg.version) },
  logLevel: "info",
});
