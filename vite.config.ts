import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false, rollupOptions: {output: {manualChunks(id) {
    if (id.includes('/node_modules/')) return 'vendor';
    if (id.endsWith('hfs_demo_data.json')) return 'demo-data';
  }}} },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts: ['.ngrok-free.dev'] },
});
