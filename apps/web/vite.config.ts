import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const envDir = path.resolve(__dirname, "../.."); // Load .env from monorepo root

const REQUIRED_FOR_BUILD = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_PARTYKIT_HOST"];

export default defineConfig(({ command, mode }) => {
  // Vite inlines env at build time. Without the root .env a production build
  // silently falls back to localhost and ships a dead site — fail here instead.
  if (command === "build") {
    const env = loadEnv(mode, envDir, "");
    const missing = REQUIRED_FOR_BUILD.filter((key) => !env[key]);
    if (missing.length) {
      throw new Error(
        `Missing ${missing.join(", ")}. Copy .env.example to .env at the monorepo root ` +
          `(${envDir}) and fill it in before building.`,
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    envDir,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
