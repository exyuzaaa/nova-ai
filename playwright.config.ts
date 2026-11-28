import { defineConfig, devices } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/user.json";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const GOOGLE_MOCK_PORT = Number(process.env.E2E_GOOGLE_PORT ?? 3199);
/** Optional: vorinstalliertes Chromium verwenden (z. B. in Cloud-Sandboxes). */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
/** nova.test → lokaler Server, damit Tracking-Tests eine „echte“ Domain haben. */
const args = ["--host-resolver-rules=MAP nova.test 127.0.0.1"];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: { executablePath, args },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { launchOptions: { executablePath, args } } },
    {
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: STORAGE_STATE,
        launchOptions: { executablePath, args },
      },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE, launchOptions: { executablePath, args } },
    },
  ],
  webServer: {
    // Erwartet einen Production-Build (npm run build) und den lokalen Supabase-Stack (npx supabase start).
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    // Gmail-Versand gegen die Google-Attrappe aus e2e/support/google-mock.ts (niemals echte Google-Server)
    env: {
      GOOGLE_CLIENT_ID: "e2e-client",
      GOOGLE_CLIENT_SECRET: "e2e-secret",
      NOVA_TEST_GOOGLE_BASE_URL: `http://127.0.0.1:${GOOGLE_MOCK_PORT}`,
    },
  },
});
