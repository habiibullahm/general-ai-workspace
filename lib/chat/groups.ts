export const historyGroups = ["Today", "Yesterday", "Older"] as const;
export type HistoryGroup = (typeof historyGroups)[number];

const formatters = new Map<string, Intl.DateTimeFormat>();
// The calendar day (yyyy-mm-dd) of an instant in a time zone; `undefined` means the viewer's own zone.
function calendarDay(ms: number, zone: string | undefined) {
  const key = zone ?? "";
  let formatter = formatters.get(key);
  if (!formatter) { formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }); formatters.set(key, formatter); }
  return Date.parse(`${formatter.format(ms)}T00:00:00Z`);
}

// Which history heading a conversation belongs under, relative to `now`.
// Pass zone "UTC" while the server renders and while the browser hydrates: neither knows the other's time zone, so both compute the
// answer from the same instant (the server's clock) on the same calendar and agree. After hydration, omit it to use the viewer's zone.
export function groupFor(dateValue: string, now: number, zone?: string): HistoryGroup {
  const difference = Math.round((calendarDay(now, zone) - calendarDay(Date.parse(dateValue), zone)) / 86_400_000);
  return difference <= 0 ? "Today" : difference === 1 ? "Yesterday" : "Older";
}

// The server's clock for this request; kept out of components so rendering stays pure.
export const requestTime = () => Date.now();
