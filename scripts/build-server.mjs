// Bundles the custom web server, the worker and the migration CLI into dist/, and copies
// the SQL migrations next to them so `node dist/migrate.js` finds dist/migrations.
// Next.js itself and runtime libraries stay external (installed in node_modules).
import { build } from "esbuild";
import { cpSync } from "node:fs";

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
  logLevel: "info",
});

cpSync("src/server/db/migrations", "dist/migrations", { recursive: true });
