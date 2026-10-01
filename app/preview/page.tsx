import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import type { ModelOption } from "@/lib/chat/models";
import { requestTime } from "@/lib/chat/groups";

export const dynamic = "force-dynamic";

// Local mock only: the pickers are shown with sample modes so the UI can be reviewed without any provider configuration.
const previewModels: ModelOption[] = [
  { id: "Fast", label: "Fast", model: "preview-fast" },
  { id: "Balanced", label: "Balanced", model: "preview-balanced" },
  { id: "Reasoning", label: "Reasoning", model: "preview-reasoning" },
];

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ChatWorkspace email="preview@nibie.local" preview models={previewModels} reasoningModes={["Reasoning"]} renderedAt={requestTime()} />;
}
