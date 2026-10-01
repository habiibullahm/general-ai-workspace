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

test("desktop chat workspace opens history and submits local messages", async ({ page }) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "New chat" }).first().click();
  await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "A thoughtful note to the team" })).toBeVisible();
  await page.getByRole("button", { name: "A thoughtful note to the team" }).click();
  await expect(page.getByText("A good note can recognize the effort")).toBeVisible();

  const composer = page.getByRole("textbox", { name: "Message Nibie" });
  await composer.fill("A local preview message");
  const oneLineHeight = await composer.evaluate((element) => element.getBoundingClientRect().height);
  await composer.press("Shift+Enter");
  await composer.type("second line");
  await expect.poll(() => composer.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(oneLineHeight);
  await composer.press("Enter");
  await expect(page.getByText("A local preview message\nsecond line")).toBeVisible();
  await expect(page.getByText("Your message is shown in this local preview.")).toContainText("Replies are not connected yet");
  await expect(page.getByLabel("Response mode")).toHaveValue("Balanced");
});

test("mobile chat workspace uses a keyboard-accessible conversation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole("button", { name: "Open conversation menu" }).click();
  const menu = page.getByRole("dialog", { name: "Conversation menu" });
  await expect(menu.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.getByRole("button", { name: "Sign out" }).focus();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Nibie home" })).toBeFocused();
  await page.getByRole("button", { name: "Learning the basics of astronomy" }).click();
  await expect(page.getByRole("button", { name: "Open conversation menu" })).toBeFocused();
  await expect(page.getByText("Start by looking up.")).toBeVisible();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Message Nibie" })).toBeVisible();
});

test("assistant replies render safe Markdown with working copy controls", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/preview");
  await page.getByRole("button", { name: "Debouncing a search box" }).click();
  await expect(page.getByRole("heading", { name: "Example" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Use wait to tune responsiveness." })).toBeVisible();
  const link = page.getByRole("link", { name: "MDN guide" });
  await expect(link).toHaveAttribute("href", "https://developer.mozilla.org/docs/Glossary/Debounce");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("target", "_blank");
  const block = page.locator(".code-block");
  await expect(block).toContainText("export function debounce");
  await expect(block.locator(".code-block-header")).toContainText("ts");

  const copyCode = block.getByRole("button", { name: "Copy ts code block" });
  await copyCode.click();
  await expect(copyCode).toContainText("Copied");
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith("export function debounce")).toBe(true);
  expect(code).toContain("timer = setTimeout(");
  expect(code.endsWith("}")).toBe(true);
  expect(code).not.toContain("```");

  await page.getByRole("button", { name: "Copy response" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("## Example");

  // The mock workspace has no server, so last-turn mutation controls stay hidden here.
  await expect(page.getByRole("button", { name: "Regenerate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});
