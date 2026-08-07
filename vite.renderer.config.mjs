import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  root: 'src/renderer',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer/src'),
    },
  },
  build: {
    outDir: '../../out/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});
