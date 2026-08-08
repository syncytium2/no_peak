import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

// All processing is client-side; the build is a static bundle served as
// Cloudflare Worker assets. No data leaves the user's machine.
export default defineConfig({
  plugins: [react()],
  define: {
    // stamped at build time so the About page can never report a stale version
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
});
