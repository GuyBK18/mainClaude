/** Dates are stored as local calendar days (YYYY-MM-DD) so a session never shifts across midnight. */

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISODate(new Date());
}

export function addDays(value: string, days: number) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(from: string, to: string) {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function yearOf(value: string) {
  return Number(value.slice(0, 4));
}

const long = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });
const short = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

export function formatDate(value: string | undefined) {
  return value ? long.format(parseISODate(value)) : "—";
}

export function formatShortDate(value: string) {
  return short.format(parseISODate(value));
}
