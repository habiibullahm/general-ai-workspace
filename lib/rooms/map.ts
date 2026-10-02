import type { RoomContextInput } from "@/lib/context/room-context";

export type RoomBriefRow = {
  goal: string | null;
  current_focus: string | null;
  important_decisions: string | null;
  open_questions: string | null;
  next_step: string | null;
};

export type RoomContextRow = {
  name: string;
  instructions: string | null;
};

export function roomContextFromRows(room: RoomContextRow | null, brief: RoomBriefRow | null): RoomContextInput | null {
  if (!room) return null;
  return {
    name: room.name,
    instructions: room.instructions,
    brief: brief
      ? {
        goal: brief.goal ?? "",
        currentFocus: brief.current_focus ?? "",
        importantDecisions: brief.important_decisions ?? "",
        openQuestions: brief.open_questions ?? "",
        next: brief.next_step ?? "",
      }
      : null,
  };
}
