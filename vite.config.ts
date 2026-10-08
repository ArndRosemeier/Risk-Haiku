import { defineConfig } from "vite";
export default defineConfig({
  root: "web",
  base: "/risk/",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "../dist-web", emptyOutDir: true },
});
