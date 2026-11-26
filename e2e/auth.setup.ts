import { expect, test as setup } from "@playwright/test";
import { signUpAndConfirm } from "./support/auth";
import { uniqueEmail } from "./support/mailpit";

export const STORAGE_STATE = "e2e/.auth/user.json";

/** Legt einen bestätigten Testnutzer an; Dashboard-Tests verwenden dessen Sitzung. */
setup("Testnutzer anmelden", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("dashboard"));
  await expect(page.getByRole("heading", { name: "Organisation anlegen" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
