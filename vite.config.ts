import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.replaceAll("\\", "/").includes("/node_modules/@supabase/"))
            return "supabase";
        },
      },
    },
  },
  server: {
    watch: {
      // Wait for editor writes to finish before caching transformed modules.
      // A truncate-then-write save can otherwise leave a cached empty module.
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      ignored: [
        "**/playwright-report/**",
        "**/test-results/**",
        "**/.artifacts/**",
        "**/.private-imports/**",
        "**/.npm-cache/**",
      ],
    },
    fs: {
      deny: [
        "**/.env",
        "**/.env.*",
        "**/*.{crt,pem}",
        "**/.git/**",
        "**/reference/**",
        "**/supabase/**",
        "**/playwright-report/**",
        "**/test-results/**",
        "**/.artifacts/**",
        "**/.private-imports/**",
      ],
    },
  },
  plugins: [
    {
      name: "reject-server-keys-in-browser-config",
      configResolved(config) {
        const key = config.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!key) return;
        let browserKey = key.startsWith("sb_publishable_") && key.length > 20;
        if (!browserKey) {
          try {
            browserKey =
              JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
                .role === "anon" && key.split(".").length === 3;
          } catch {
            /* Reject malformed or secret keys. */
          }
        }
        if (!browserKey)
          throw new Error(
            "VITE_SUPABASE_PUBLISHABLE_KEY must be a browser-safe publishable or legacy anon key. Server keys are forbidden.",
          );
      },
    },
    {
      name: "isolate-reference-evidence",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          let pathname: string;
          try {
            pathname = decodeURIComponent(
              new URL(request.url ?? "/", "http://localhost").pathname,
            ).replaceAll("\\", "/");
          } catch {
            response.statusCode = 400;
            response.end("Invalid request path.");
            return;
          }
          if (/(?:^|\/)(reference|\.private-imports)(?:\/|$)/i.test(pathname)) {
            response.statusCode = 403;
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.end(
              "Reference sources are offline evidence and are not served.",
            );
            return;
          }
          next();
        });
      },
    },
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "brand/*.png"],
      manifest: {
        id: "/",
        name: "Bellefort Estates · Community",
        short_name: "Bellefort",
        description: "Your Bellefort community, together.",
        theme_color: "#8b002b",
        background_color: "#faf9fa",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ["packages/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    environment: "node",
    // PGlite-backed migration fixtures need a little more startup time on CI.
    hookTimeout: 30_000,
  },
});
