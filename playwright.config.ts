import { defineConfig, devices } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/user.json";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Optional: vorinstalliertes Chromium verwenden (z. B. in Cloud-Sandboxes). */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { launchOptions: { executablePath } } },
    {
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: STORAGE_STATE,
        launchOptions: { executablePath },
      },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE, launchOptions: { executablePath } },
    },
  ],
  webServer: {
    // Erwartet einen Production-Build (npm run build) und den lokalen Supabase-Stack (npx supabase start).
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
});
