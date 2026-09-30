import { expect, test } from "@playwright/test";

test("home page shows the workspace shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little room to think." })).toBeVisible();
  await expect(page.getByText("General AI Workspace")).toBeVisible();
});
