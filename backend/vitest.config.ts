import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Integration suites share one database — run files sequentially.
    fileParallelism: false,
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  },
});
