import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL('../../.harness-dist', import.meta.url)), emptyOutDir: true },
});
