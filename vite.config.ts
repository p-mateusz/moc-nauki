import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-slot',
      '@radix-ui/react-context-menu',
      '@radix-ui/primitive',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  },
  build: {
    commonjsOptions: {
      include: [
        /node_modules/,
      ],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  ssr: {
    noExternal: ['@radix-ui'],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
