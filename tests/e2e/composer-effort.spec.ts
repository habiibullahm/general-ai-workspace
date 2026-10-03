import { expect, test, type Page } from "@playwright/test";

// Reasoning effort is enabled only for a model that supports it (GPT-6 Luna in the preview); the model stays a separate choice.
async function chooseReasoningModel(page: Page) {
  await page.getByRole("button", { name: /^Model:/ }).click();
  await page.getByRole("menuitemradio", { name: "GPT-6 Luna", exact: true }).click();
}

for (const [stored, selected] of [["low", "Low"], ["medium", "Medium"], ["high", "High"], ["auto", "Medium"], ["invalid", "Medium"]]) {
  test(`preserves stored ${stored} and displays ${selected}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("nibie-reasoning", value), stored);
    await page.goto("/preview");
    await chooseReasoningModel(page);
    await expect(page.getByRole("button", { name: `Reasoning: ${selected}`, exact: true })).toHaveText(selected);
    expect(await page.evaluate(() => localStorage.getItem("nibie-reasoning"))).toBe(stored);
  });
}

test("fresh composer defaults to Medium and remembers High for the next chat", async ({ page }) => {
  await page.goto("/preview");
  // Model and reasoning are separate controls; reasoning explains itself when the model cannot use an effort.
  await expect(page.getByRole("button", { name: "Model: Auto", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reasoning: Medium (Reasoning effort is unavailable for this chat)", exact: true })).toBeDisabled();
  await chooseReasoningModel(page);
  await expect(page.getByRole("button", { name: "Reasoning: Medium", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reasoning: Medium", exact: true })).toHaveText("Medium");
  await page.getByRole("button", { name: "Reasoning: Medium", exact: true }).click();
  await expect(page.getByRole("menuitemradio")).toHaveText([/^Low/, /^Medium/, /^High/]);
  await page.getByRole("menuitemradio", { name: /High/ }).click();
  await expect(page.getByRole("button", { name: "Reasoning: High", exact: true })).toHaveText("High");
  await expect(page.getByRole("button", { name: "Model: GPT-6 Luna", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nibie-reasoning"))).toBe("high");
  // Changing the model keeps the chosen effort; an unsupported model only disables it.
  await page.getByRole("button", { name: "Model: GPT-6 Luna", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "MiniMax M2.7", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reasoning: High (Reasoning effort is unavailable for this chat)", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("nibie-reasoning"))).toBe("high");
  await page.reload();
  await chooseReasoningModel(page);
  await expect(page.getByRole("button", { name: "Reasoning: High", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await chooseReasoningModel(page);
  await expect(page.getByRole("button", { name: "Reasoning: High", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Room: General", exact: true })).toBeVisible();
});

test("Plus is a subtle accessible icon button connected to the existing safe attachment flow", async ({ page }) => {
  await page.goto("/preview");
  const attachment = page.getByRole("button", { name: "Attach file", exact: true });
  await expect(attachment).toHaveAttribute("title", "Attach file");
  await expect(attachment).toHaveAttribute("type", "button");
  await expect(attachment).toHaveText("");
  await expect(attachment.locator("svg.lucide-plus")).toHaveCount(1);
  await attachment.focus();
  await expect(attachment).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("This preview isn't connected.", { exact: true })).toBeVisible();
  await expect(page.locator(".message-row.user")).toHaveCount(0);
});
