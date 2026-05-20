import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config for the GritSync mobile experience.
 *
 * Real React Native apps can't be driven by Playwright — they need
 * Detox or Maestro. But the mobile app and the web client share the
 * same backend, so testing the web app under a phone-sized viewport
 * exercises every API the mobile app depends on (login, applications,
 * documents, messages, NCLEX hub, Stripe checkout). When a mobile-app
 * bug turns out to be an API contract issue, this suite catches it.
 *
 * Targets:
 *   • Pixel 7 (Android emulation)  → app.gritsync.com
 *   • iPhone 15 (iOS emulation)    → app.gritsync.com
 *   • iPhone 15 + dark mode        → covers theme regressions
 *
 * Run locally:
 *   cd mobile-e2e
 *   npm install
 *   npx playwright install chromium webkit
 *   npx playwright test
 *
 * Run against staging / a local backend by overriding GRITSYNC_BASE:
 *   GRITSYNC_BASE=http://localhost:5173 npx playwright test
 */

const BASE = process.env.GRITSYNC_BASE ?? 'https://app.gritsync.com'

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'en-US',
  },
  projects: [
    {
      name: 'android-pixel-7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'ios-iphone-15',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'ios-iphone-15-dark',
      use: { ...devices['iPhone 15'], colorScheme: 'dark' },
    },
  ],
})
