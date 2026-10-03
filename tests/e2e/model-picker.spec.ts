import { expect, test } from "@playwright/test";
import { removeConversation } from "./remove-conversation";

// Effort is independent of the saved backend mode; provider names stay out of the composer.
test("reasoning effort is sent only when supported and persists without exposing model names", async ({ page }) => {
  test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD, "Requires a dedicated authenticated test account and real provider configuration.");
  test.setTimeout(240_000);
  let conversationUrl: string | undefined;
  try {
    await page.addInitScript(() => localStorage.setItem("nibie-reasoning", "high"));
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/chat", { timeout: 20_000 });
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    // Model and reasoning are separate controls; GPT-6 Luna is the configured model that accepts an effort.
    await page.getByRole("button", { name: "Model: Auto", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "GPT-6 Luna", exact: true }).click();
    const reasoning = page.getByRole("button", { name: /^Reasoning: High/ });
    await expect(reasoning).toHaveText("High");
    const supported = await reasoning.isEnabled();
    if (supported) {
      await reasoning.click();
      await expect(page.getByRole("menu", { name: "Reasoning", exact: true }).getByRole("menuitemradio")).toHaveText([/Low/, /Medium/, /High/]);
      await page.keyboard.press("Escape");
    } else {
      await expect(reasoning).toHaveAttribute("title", "Reasoning effort is unavailable for this chat");
    }
    const sent = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/chat" && request.method() === "POST", { timeout: 60_000 });
    await page.getByRole("textbox", { name: "Message Nibie" }).fill("Reply with one short sentence about tides.");
    await page.getByRole("button", { name: "Send message" }).click();
    const request = (await sent).postDataJSON();
    if (supported) expect(request.reasoning).toBe("high");
    else expect(request).not.toHaveProperty("reasoning");
    expect(request).not.toHaveProperty("provider");
    await expect(page.getByRole("button", { name: "Regenerate", exact: true })).toBeVisible({ timeout: 120_000 });
    conversationUrl = page.url();
    await page.reload();
    await expect(page.getByRole("button", { name: /^Model:/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Reasoning: High/ })).toHaveText("High");
    expect(await page.evaluate(() => localStorage.getItem("nibie-reasoning"))).toBe("high");
  } finally {
    await removeConversation(page, conversationUrl);
  }
});
