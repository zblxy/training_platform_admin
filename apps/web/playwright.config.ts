import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:15173', launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } },
  webServer: process.env.E2E_BASE_URL ? undefined : [
    { command: 'node ../api/dist/main.js', url: 'http://127.0.0.1:13000/api/health', env: { PORT: '13000', NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@127.0.0.1:15432/test' }, reuseExistingServer: false },
    { command: 'npm run dev -- --port 15173', url: 'http://127.0.0.1:15173', env: { API_PROXY_TARGET: 'http://127.0.0.1:13000' }, reuseExistingServer: false },
  ],
});
