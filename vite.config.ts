import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function findExistingFile(basePath: string): string | null {
  const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      return fullPath;
    }
  }
  // Check if it's a directory containing index.ts/index.tsx etc.
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      const indexPath = path.join(basePath, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }
  return null;
}

function dynamicAliasPlugin(activeThemeFolder: string) {
  return {
    name: 'vite-dynamic-alias-plugin',
    enforce: 'pre',
    resolveId(source: string, importer: string | undefined) {
      if (source.startsWith('@/')) {
        const subPath = source.substring(2);
        
        let themeName = '';
        if (importer) {
          const normalizedImporter = importer.replace(/\\/g, '/');
          if (normalizedImporter.includes('/theme/neobrutalism/')) {
            themeName = 'neobrutalism';
          } else if (normalizedImporter.includes('/theme/glashmorphism/')) {
            themeName = 'glashmorphism';
          } else if (normalizedImporter.includes('/theme/claymorphism/')) {
            themeName = 'claymorphism';
          }
        }
        
        if (!themeName && activeThemeFolder && activeThemeFolder !== 'standar') {
          themeName = activeThemeFolder;
        }

        // Try theme directory first if applicable
        if (themeName) {
          const themeDir = path.resolve(__dirname, `./theme/${themeName}`);
          const themePath = path.resolve(themeDir, subPath);
          const existingThemeFile = findExistingFile(themePath);
          if (existingThemeFile) {
            return existingThemeFile;
          }
        }

        // Fallback to main src directory
        const mainDir = path.resolve(__dirname, './src');
        const mainPath = path.resolve(mainDir, subPath);
        const existingMainFile = findExistingFile(mainPath);
        if (existingMainFile) {
          return existingMainFile;
        }
      }
      return null;
    }
  };
}

function transformHtmlPlugin(activeThemeFolder: string) {
  return {
    name: 'vite-transform-html-plugin',
    enforce: 'pre' as const,
    load(id: string) {
      if (id.replace(/\\/g, '/').endsWith('/index.html')) {
        let html = fs.readFileSync(id, 'utf-8');
        if (activeThemeFolder && activeThemeFolder !== 'standar') {
          html = html.replace('/src/main.tsx', `/theme/${activeThemeFolder}/main.tsx`);
        }
        return html;
      }
      return null;
    },
    transformIndexHtml(html: string) {
      if (activeThemeFolder && activeThemeFolder !== 'standar') {
        return html.replace('/src/main.tsx', `/theme/${activeThemeFolder}/main.tsx`);
      }
      return html;
    },
    configureServer(server) {
      server.middlewares.use('/__theme_changed', (req, res) => {
        console.log('[Vite Dev Server] Received theme change signal. Restarting server...');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        server.restart();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const activeThemeFolder = "standar";
  console.log("[Vite Theme Resolver] Active theme folder set to 'standar' for runtime theme switching.");
  // Load env vars so we can use them in proxy config (Node.js context)
  const env = loadEnv(mode, process.cwd(), "");
  const serverKey = env.VITE_MIDTRANS_SERVER_KEY;
  const isProduction = env.VITE_MIDTRANS_IS_PRODUCTION === "true";
  const midtransApiBase = isProduction
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  const authBase64 = serverKey
    ? Buffer.from(serverKey + ":").toString("base64")
    : "";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api/midtrans-charge": {
          target: midtransApiBase,
          changeOrigin: true,
          rewrite: () => "/v2/charge",
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/midtrans-snap": {
          target: isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com",
          changeOrigin: true,
          rewrite: () => "/snap/v1/transactions",
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/midtrans-status": {
          target: midtransApiBase,
          changeOrigin: true,
          rewrite: (reqPath) => {
            const match = reqPath.match(/orderId=([^&]+)/);
            const orderId = match ? decodeURIComponent(match[1]) : "";
            return `/v2/${orderId}/status`;
          },
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
            });
          },
        },
        "/api/midtrans": {
          target: "https://app.sandbox.midtrans.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/midtrans/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/midtrans-prod": {
          target: "https://app.midtrans.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/midtrans-prod/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
      },
    },
    plugins: [
      dynamicAliasPlugin(activeThemeFolder),
      transformHtmlPlugin(activeThemeFolder),
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
      },
    },
    optimizeDeps: {
      force: false,
    },
    build: { 
      sourcemap: false,
      target: 'esnext',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor';
              if (id.includes('lucide-react') || id.includes('sonner') || id.includes('vaul')) return 'ui-vendor';
              return 'vendor';
            }
          }
        }
      }
    },
  };
});
