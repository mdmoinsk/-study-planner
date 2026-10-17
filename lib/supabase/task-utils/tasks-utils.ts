

export type DeadlineStatus =
  | "none" // no deadline, or an invalid one
  | "completed" // finished tasks are never overdue
  | "overdue"
  | "today"
  | "soon"
  | "upcoming";

// A task is "due soon" when its deadline is 1 to 3 days from today.
export const DUE_SOON_DAYS = 3;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseParts(value: string): [number, number, number] | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Reject impossible dates such as 2026-02-31.
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  return [year, month, day];
}

export function isValidDateString(value: string | null | undefined): boolean {
  return typeof value === "string" && parseParts(value) !== null;
}

// Today's date in the user's local time zone, as YYYY-MM-DD.
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Whole days from `from` to `to` (negative if `to` is earlier).
// Uses UTC midnight for both so daylight-saving changes cannot skew it.
export function daysBetween(from: string, to: string): number | null {
  const a = parseParts(from);
  const b = parseParts(to);
  if (!a || !b) return null;

  const start = Date.UTC(a[0], a[1] - 1, a[2]);
  const end = Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round((end - start) / 86_400_000);
}

export function formatDeadline(value: string | null | undefined): string {
  if (!value) return "";
  const parts = parseParts(value);
  if (!parts) return "Invalid date";

  // Noon avoids edge cases around midnight in any time zone.
  return new Date(parts[0], parts[1] - 1, parts[2], 12).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

export function getDeadlineStatus(
  task: { completed: boolean; deadline: string },
  today: string
): DeadlineStatus {
  if (task.completed) return "completed";
  if (!task.deadline || !today) return "none";

  const diff = daysBetween(today, task.deadline);
  if (diff === null) return "none";

  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= DUE_SOON_DAYS) return "soon";
  return "upcoming";
}

// A Date for a YYYY-MM-DD string at local noon, or null if invalid.
export function toLocalDate(value: string): Date | null {
  const parts = parseParts(value);
  if (!parts) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 12);
}

// Add (or subtract) whole days. Month and year boundaries are handled by Date.
export function addDays(value: string, days: number): string | null {
  const parts = parseParts(value);
  if (!parts) return null;
  return getLocalDateString(
    new Date(parts[0], parts[1] - 1, parts[2] + days, 12)
  );
}

// The Monday of the week containing `value`.
export function getWeekStart(value: string): string | null {
  const date = toLocalDate(value);
  if (!date) return null;
  const sinceMonday = (date.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
  return addDays(value, -sinceMonday);
}