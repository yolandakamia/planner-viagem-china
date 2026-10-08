import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const VERSAO = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// base "./": every path is relative, so the app works under
// usuario.github.io/nome-do-repo/ whatever the repo is called.
export default defineConfig({
  base: "./",
  define: { __VERSAO__: JSON.stringify(VERSAO) },
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",          // ask before swapping to a new version
      injectRegister: false,           // registered by useRegisterSW in App
      includeAssets: ["icons/*.png", "favicon.svg"],
      manifest: {
        name: "Viagem China 2026",
        short_name: "Viagem China",
        description: "Agenda, mala e looks da viagem à China — funciona offline.",
        lang: "pt-BR",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#faf7f5",
        theme_color: "#b3261e",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // precache everything the build produces: the app must work offline
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,json}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
