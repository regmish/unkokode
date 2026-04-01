import { defineConfig } from "vite";
import { resolve } from "node:path";

const buildTarget = process.env.BUILD_TARGET || "pages";

export default defineConfig(() => {
  if (buildTarget === "background") {
    return {
      root: ".",
      publicDir: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, "src/background/index.ts"),
          formats: ["es"],
          fileName: () => "background.js"
        }
      }
    };
  }

  if (buildTarget === "content") {
    return {
      root: ".",
      publicDir: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, "src/content/index.ts"),
          formats: ["iife"],
          name: "NepaliContentScript",
          fileName: () => "content.js"
        }
      }
    };
  }

  return {
    root: ".",
    publicDir: "public",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html"),
          options: resolve(__dirname, "options.html")
        },
        output: {
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]"
        }
      }
    }
  };
});
