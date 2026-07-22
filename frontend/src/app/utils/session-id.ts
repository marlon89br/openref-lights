/** Excludes visually ambiguous characters (0/O, 1/I/L) so IDs are easy to read and type. */
const SESSION_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const SESSION_ID_LENGTH = 6;

/** Must match the backend's SESSION_ID_PATTERN in lift.constants.ts. */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{3,32}$/;

/** Generates a short, human-shareable session/platform ID, e.g. "K7XM2P". */
export function generateSessionId(): string {
  let id = '';

  for (let i = 0; i < SESSION_ID_LENGTH; i++) {
    id += SESSION_ID_ALPHABET[Math.floor(Math.random() * SESSION_ID_ALPHABET.length)];
  }

  return id;
}

export function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}

/** Normalizes user-entered session IDs: trims whitespace and uppercases for consistency. */
export function normalizeSessionId(sessionId: string): string {
  return sessionId.trim().toUpperCase();
}
