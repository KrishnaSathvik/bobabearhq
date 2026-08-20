import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? 4319)

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Build in test mode so the app runs on localStorage instead of the real
  // Supabase project, then serve that build the same way `npm run dev` does.
  webServer: {
    command: `npm run build -- --mode test && PORT=${port} node scripts/local-server.mjs`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
