import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  publicDir: 'public',
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
