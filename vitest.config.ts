import path from "node:path";
import { defineConfig } from "vitest/config";

// Dedicated Vitest root so the pure-logic suites in tests/ are picked up
// (the app's vite.config roots at client/ for the web build).
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
