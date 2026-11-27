import {defineConfig, devices} from '@playwright/test';

const launchOptions = process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {};
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:4273', launchOptions},
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 1000}}},
    {name: 'mobile', use: {...devices['Pixel 7']}},
  ],
  webServer: {command: 'node tests/serve.mjs', url: 'http://127.0.0.1:4273', timeout: 20000},
});
