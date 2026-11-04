import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  // CI writes blob reports per shard; a later job merges them into one HTML report.
  reporter: CI ? [['blob'], ['github'], ['list']] : [['html', { open: 'never' }], ['list']],
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /(ui|a11y)\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      testMatch: /ui\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    { name: 'api', testMatch: /api\/.*\.spec\.ts/, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'npm run app',
    url: `${baseURL}/login`,
    reuseExistingServer: !CI,
    timeout: 60_000,
    env: { PORT: String(PORT) },
  },
});
