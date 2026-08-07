import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// All processing is client-side; the build is a static bundle served as
// Cloudflare Worker assets. No data leaves the user's machine.
export default defineConfig({
  plugins: [react()],
});
