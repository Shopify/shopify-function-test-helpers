import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/test/**/*.test.js'],
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['**/node_modules/**', '**/test/**']
    }
  }
});