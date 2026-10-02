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

export type RoomDraft = {
  name: string;
  description?: string | null;
};

export type RoomPatch = {
  name?: string;
  description?: string | null;
  instructions?: string | null;
};
