import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // The e2e suite is Playwright's; running it under Vitest would start
    // browsers from the wrong runner.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environmentMatchGlobs: [['tests/unit/**/*.tsx', 'jsdom']],
    globals: true,
  },
});
