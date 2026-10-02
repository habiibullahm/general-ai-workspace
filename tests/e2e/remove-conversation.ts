import { expect, type Page } from "@playwright/test";
import { validateConversationId } from "../../lib/chat/validation";

export function conversationIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = validateConversationId(new URL(url).searchParams.get("conversation"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Deletes one conversation, the id captured from that test's URL. Titles are not unique.
export async function removeConversation(page: Page, url: string | undefined) {
  const id = conversationIdFromUrl(url);
  if (!id) return;
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.goto(`/chat?conversation=${encodeURIComponent(id)}`);
  await expect(page).toHaveURL((url) => url.pathname === "/chat" && url.searchParams.get("conversation") === id);
  const remove = page.locator(".desktop-sidebar").locator(`[data-conversation-id="${id}"]`).getByRole("button", { name: /^Delete / });
  if (await remove.count() !== 1) return;
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.locator(".desktop-sidebar").locator(`[data-conversation-id="${id}"]`)).toHaveCount(0);
}
