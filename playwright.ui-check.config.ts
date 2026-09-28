import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // UI_CHECK_PORT cho phép chạy test với worktree dev server (vd 3001)
  // khi port 3000 đã bị main checkout chiếm
  use: {
    baseURL: "https://localhost:3007",
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // webServer block removed — dev server already running on port 3000
  // (echo command in old config did not start a server, causing timeout)
});