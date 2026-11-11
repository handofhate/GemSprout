import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  publicDir: 'public',
  define: {
    GEMSPROUT_V2_DATA_SOURCE: JSON.stringify(process.env.VITE_GEMSPROUT_DATA_SOURCE || ''),
    GEMSPROUT_V2_FIREBASE_TARGET: JSON.stringify(process.env.VITE_GEMSPROUT_FIREBASE_TARGET || 'dev'),
  },
  build: {
    outDir: 'dist-app',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4273,
    strictPort: false,
  },
});
