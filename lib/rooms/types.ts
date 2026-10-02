export const roomNameLimit = 80;
export const roomDescriptionLimit = 500;
export const roomInstructionsLimit = 2000;
export const roomBriefFieldLimit = 500;

export type RoomBriefFields = {
  goal: string | null;
  currentFocus: string | null;
  importantDecisions: string | null;
  openQuestions: string | null;
  next: string | null;
};

export const roomBriefFields: Array<{ key: keyof RoomBriefFields; label: string }> = [
  { key: "goal", label: "Goal" },
  { key: "currentFocus", label: "Current focus" },
  { key: "importantDecisions", label: "Important decisions" },
  { key: "openQuestions", label: "Open questions" },
  { key: "next", label: "Next" },
];

export type RoomOverview = { description: string | null; brief: RoomBriefFields };

export type RoomDraft = {
  name: string;
  description?: string | null;
};

export type RoomPatch = {
  name?: string;
  description?: string | null;
  instructions?: string | null;
};
