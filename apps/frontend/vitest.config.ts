import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      env: {
        VITE_API_BASE_URL: "",
      },
    },
  }),
);
