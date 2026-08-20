import { defineConfig, devices } from '@playwright/test'

// The shared-workspace suite talks to a real Supabase project, so it drives an
// already-running app instead of building and serving one.
export default defineConfig({
  testDir: './tests',
  testMatch: 'shared-workspace.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BOBA_E2E_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
