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

/** Seconds to a rough "time left" phrase, e.g. "about 12 min left". */
export function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return "less than a minute left";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `about ${hours} h ${rest} min left` : `about ${hours} h left`;
}

/**
 * A function that swaps "Speaker 1", "Speaker 2", ... in text for the names
 * staff assigned. Used on the notes, which the summary model writes with
 * "Speaker N" (SPEAKER_00 is "Speaker 1"). Unnamed speakers stay as they are.
 */
export function speakerRenamer(names: Record<string, string>): (text: string) => string {
  return (text) =>
    text.replace(/\bSpeaker (\d+)\b/g, (match, n: string) => {
      const label = `SPEAKER_${String(Number(n) - 1).padStart(2, "0")}`;
      return names[label] ?? match;
    });
}

/** An ISO timestamp as a short local date and time, e.g. "Oct 22, 7:46 PM". */
export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${hours}:${minutes} ${d.getHours() < 12 ? "AM" : "PM"}`;
}
