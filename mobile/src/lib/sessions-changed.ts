/**
 * A one-bit signal from screens that change the session list (deleting a
 * session) to the Past sessions screen, which may still be loaded underneath.
 * When it's shown again it checks this and reloads, so a deleted session
 * doesn't linger in the list.
 */
let changed = false;

export function markSessionsChanged(): void {
  changed = true;
}

/** True once after a change; reading it clears it. */
export function takeSessionsChanged(): boolean {
  const was = changed;
  changed = false;
  return was;
}
