import type { ProviderMessage } from "@/lib/ai/provider";
import { CONTEXT_DATA_PREAMBLE } from "@/lib/context/context-policy";
import type { ContextPlan } from "@/lib/context/context-types";

export function toProviderMessages(plan: ContextPlan): ProviderMessage[] {
  const messages: ProviderMessage[] = [];
  const core = plan.blocks.find((block) => block.id === "core" && block.included);
  if (core) messages.push({ role: "system", content: core.text });
  const profile = plan.blocks.find((block) => block.id === "profile" && block.included);
  const room = plan.blocks.find((block) => block.id === "room" && block.included);
  const summary = plan.blocks.find((block) => block.id === "thread_summary" && block.included);
  if (profile || room || summary) {
    messages.push({ role: "system", content: [CONTEXT_DATA_PREAMBLE, profile?.text, room?.text, summary?.text].filter(Boolean).join("\n\n") });
  }
  for (const block of plan.blocks) {
    if (!block.included || !block.dialogueRole) continue;
    if (block.id !== "recent_messages" && block.id !== "current_request") continue;
    messages.push({ role: block.dialogueRole, content: block.text });
  }
  return messages;
}
