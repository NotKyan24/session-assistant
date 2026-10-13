/**
 * FORMATTING HELPERS: small functions that turn raw values into display text.
 * Kept separate from the screens so they're easy to test and reuse.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Default session name, e.g. "Tue group, Oct 7". */
export function defaultSessionName(date = new Date()): string {
  return `${DAYS[date.getDay()]} group, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Seconds to "mm:ss" (or "h:mm:ss" past an hour). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** "SPEAKER_00" -> "Speaker 1"; anything else passes through. */
export function speakerName(speaker: string): string {
  const match = /^SPEAKER_(\d+)$/.exec(speaker);
  return match ? `Speaker ${Number(match[1]) + 1}` : speaker;
}
