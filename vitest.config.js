import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Separate from vite.config.js so tests run without the Base44 dev plugin.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./base44/shared', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
  },
});
