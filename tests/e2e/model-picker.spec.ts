import { expect, test, type Page, type Request } from "@playwright/test";
import { removeConversation } from "./remove-conversation";

// Authenticated checks for the model picker and the reasoning control against a real (or local) workspace.
// A skip never counts as acceptance. The reasoning part adapts to the server's configuration: the control must be absent unless the
// server declares support (AI_REASONING_MODES), and a non-Auto level must only ever be sent for a supporting mode.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password, "E2E_USER_EMAIL and E2E_USER_PASSWORD are required.");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/", { timeout: 20_000 });
}

const isChatPost = (request: Request) => new URL(request.url()).pathname === "/api/chat" && request.method() === "POST";
const modelButton = (page: Page, name?: string) => page.getByRole("button", { name: name ? `Model: ${name}` : /^Model:/ });
const regenerate = (page: Page) => page.getByRole("button", { name: "Regenerate", exact: true });

async function chooseModel(page: Page, name: string) {
  await modelButton(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(name) }).click();
  await expect(modelButton(page, name)).toBeVisible();
}

test("the chosen model is sent with the request, is saved on the conversation, and survives a refresh", async ({ page }) => {
  test.setTimeout(240_000);
  let url: string | undefined;
  try {
    await login(page);
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();

    // Only configured modes are offered; pick one that is not the current selection.
    await modelButton(page).click();
    const offered = await page.getByRole("menuitemradio").allInnerTexts();
    await page.keyboard.press("Escape");
    expect(offered.length).toBeGreaterThan(0);
    const names = offered.map((text) => text.split("\n")[0].trim());
    const current = ((await modelButton(page).getAttribute("aria-label")) ?? "").replace("Model: ", "");
    const chosen = names.find((name) => name !== current) ?? current;
    await chooseModel(page, chosen);

    await page.getByRole("textbox", { name: "Message Nibie" }).fill("Reply with exactly one short sentence about rivers.");
    const sent = page.waitForRequest(isChatPost, { timeout: 60_000 });
    await page.getByRole("button", { name: "Send message" }).click();
    const request = await sent;
    // The client names a mode (never a provider model id); the server maps it.
    expect(request.postDataJSON().model).toBe(chosen);
    expect(Object.keys(request.postDataJSON()).sort()).not.toContain("provider");
    await expect(regenerate(page)).toBeVisible({ timeout: 120_000 });
    url = page.url();

    await page.reload();
    await expect(modelButton(page, chosen)).toBeVisible();

    // Changing it later is saved in the background and is also what a fresh load shows.
    const other = names.find((name) => name !== chosen);
    if (other) {
      await chooseModel(page, other);
      await expect.poll(async () => { await page.reload(); return modelButton(page, other).isVisible(); }, { timeout: 20_000, intervals: [1000] }).toBe(true);
    }
  } finally {
    await removeConversation(page, url);
  }
});

test("reasoning is hidden unless supported, disabled for other modes, and only sent for a supporting mode", async ({ page }) => {
  test.setTimeout(240_000);
  let url: string | undefined;
  try {
    await login(page);
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();
    const reasoning = page.getByRole("button", { name: /^Reasoning:/ });

    if (await reasoning.count() === 0) {
      // The server declares no reasoning support: nothing is offered and nothing is ever sent.
      await page.getByRole("textbox", { name: "Message Nibie" }).fill("Reply with exactly one short sentence about moons.");
      const sent = page.waitForRequest(isChatPost, { timeout: 60_000 });
      await page.getByRole("button", { name: "Send message" }).click();
      expect(Object.keys((await sent).postDataJSON())).not.toContain("reasoning");
      await expect(regenerate(page)).toBeVisible({ timeout: 120_000 });
      url = page.url();
      return;
    }

    // A mode without support disables the control with a reason.
    await modelButton(page).click();
    const names = (await page.getByRole("menuitemradio").allInnerTexts()).map((text) => text.split("\n")[0].trim());
    await page.keyboard.press("Escape");
    const unsupported = await (async () => {
      for (const name of names) { await chooseModel(page, name); if (await reasoning.isDisabled()) return name; }
      return undefined;
    })();
    if (unsupported) await expect(reasoning).toHaveAttribute("aria-label", /Not supported by/);

    // A supporting mode enables it, and the chosen level is what the request carries.
    const supported = await (async () => {
      for (const name of names) { await chooseModel(page, name); if (await reasoning.isEnabled()) return name; }
      return undefined;
    })();
    expect(supported).toBeTruthy();
    await reasoning.click();
    await page.getByRole("menuitemradio", { name: /Low/ }).click();
    await expect(page.getByRole("button", { name: "Reasoning: Low", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Message Nibie" }).fill("Reply with exactly one short sentence about tides.");
    const sent = page.waitForRequest(isChatPost, { timeout: 60_000 });
    await page.getByRole("button", { name: "Send message" }).click();
    const body = (await sent).postDataJSON();
    expect(body.model).toBe(supported);
    expect(body.reasoning).toBe("low");
    await expect(regenerate(page)).toBeVisible({ timeout: 120_000 });
    url = page.url();

    // The model and the level are separate: the level is remembered per device across a reload.
    await page.reload();
    await expect(page.getByRole("button", { name: "Reasoning: Low", exact: true })).toBeVisible();
  } finally {
    await removeConversation(page, url);
  }
});
