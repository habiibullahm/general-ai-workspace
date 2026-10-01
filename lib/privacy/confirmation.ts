export const DELETE_ALL_CONFIRMATION = "DELETE";

// Exact phrase, after trimming surrounding whitespace. Other casings do not confirm.
export function isDeleteAllConfirmed(value: unknown): value is typeof DELETE_ALL_CONFIRMATION {
  return typeof value === "string" && value.trim() === DELETE_ALL_CONFIRMATION;
}
