// A short clock label. Same-day messages show only the time so the transcript stays quiet.
export function formatMessageTimestamp(value: string, now = Date.now(), locale?: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(now);
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  if (sameDay) return time;
  const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
  return `${day} · ${time}`;
}
