import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // eslint-disable-next-line no-undef
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173, // Force Vite to always use port 5173
    strictPort: true, // Prevent switching to another port if 5173 is in use
  },
});
