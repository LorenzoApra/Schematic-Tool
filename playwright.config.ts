import { defineConfig, devices } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Keep test Firefox away from personal browser data protected by macOS.
// https://github.com/microsoft/playwright/issues/42768
const firefoxData =
  process.platform === 'darwin'
    ? mkdtempSync(join(tmpdir(), 'schematic-firefox-'))
    : undefined

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  maxFailures: 3,
  workers: 3,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175/Schematic-Tool/',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || undefined,
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: firefoxData
          ? {
              env: {
                ...process.env,
                CFFIXED_USER_HOME: firefoxData,
                MOZ_APP_DATA: firefoxData,
                MOZ_LOCAL_APP_DATA: firefoxData,
              },
            }
          : {},
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 5175',
    url: 'http://127.0.0.1:5175/Schematic-Tool/',
    reuseExistingServer: false,
  },
})
