import { expect, test } from "@playwright/test";

test("unauthenticated visitors are sent to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  await expect(page).toHaveTitle("Nibie");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nibie" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("sign-up page provides an account creation form", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});
