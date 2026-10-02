import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("room onboarding drafts from a name or goal, preserves edits, and survives refresh", async ({ page }) => {
  test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD, "Requires the dedicated test account and real AI provider.");
  test.setTimeout(180_000);
  let roomId: string | null = null;
  const name = `Persiapan interview backend ${Date.now()}`;
  const description = "Deskripsi pilihan pengguna: latihan Java dan Spring Boot.";
  const goal = "Lulus wawancara backend dalam dua minggu.";

  try {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/chat", { timeout: 20_000 });
    await page.getByRole("button", { name: "New room", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Draft my room", exact: true })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Room name", exact: true }).fill(name);
    // A name alone is enough; the purpose question is optional.
    await dialog.getByRole("button", { name: "Draft my room", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(/\S/, { timeout: 60_000 });
    for (const field of ["Goal", "Current focus", "Important decisions", "Open questions", "Next"]) {
      await expect(dialog.getByRole("textbox", { name: field, exact: true })).toHaveValue(/\S/);
    }
    await expect(dialog.getByRole("textbox", { name: "Description", exact: true })).not.toHaveValue(/<think>/);
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await dialog.getByRole("textbox", { name: "What would you like to achieve here? (optional)", exact: true }).fill(goal);
    await dialog.getByRole("button", { name: "Draft my room", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(/\S/, { timeout: 60_000 });
    if (process.env.E2E_ROOM_SCREENSHOT) await page.screenshot({ path: process.env.E2E_ROOM_SCREENSHOT });
    await dialog.getByRole("textbox", { name: "Description", exact: true }).fill(description);
    await dialog.getByRole("textbox", { name: "Goal", exact: true }).fill(goal);
    await dialog.getByRole("button", { name: "Create room", exact: true }).click();
    await expect(page).toHaveURL((url) => Boolean(url.searchParams.get("room")), { timeout: 20_000 });
    roomId = new URL(page.url()).searchParams.get("room");
    await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(description);
    await expect(page.getByRole("textbox", { name: "Goal", exact: true })).toHaveValue(goal);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(description);
    await expect(page.getByRole("textbox", { name: "Goal", exact: true })).toHaveValue(goal);
    const rewrittenDescription = "Deskripsi baru setelah room dibuat.";
    const rewrittenGoal = "Fokus Spring Security dan system design.";
    await page.getByRole("textbox", { name: "Description", exact: true }).fill(rewrittenDescription);
    await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(rewrittenDescription);
    await page.getByRole("button", { name: "Save room", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save room", exact: true })).toBeEnabled();
    await page.getByRole("textbox", { name: "Goal", exact: true }).fill(rewrittenGoal);
    await expect(page.getByRole("textbox", { name: "Goal", exact: true })).toHaveValue(rewrittenGoal);
    await page.getByRole("button", { name: "Save brief", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save brief", exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(rewrittenDescription);
    await expect(page.getByRole("textbox", { name: "Goal", exact: true })).toHaveValue(rewrittenGoal);
  } finally {
    if (roomId) {
      // Delete only the new room owned by the dedicated test account.
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { error: loginError } = await client.auth.signInWithPassword({ email: process.env.E2E_USER_EMAIL!, password: process.env.E2E_USER_PASSWORD! });
      if (loginError) throw new Error("Test room cleanup could not sign in.");
      const { error } = await client.from("rooms").delete().eq("id", roomId).eq("name", name);
      if (error) throw new Error("Test room cleanup failed.");
    }
  }
});
