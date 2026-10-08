export const PLAYER_COUNT_MIN = 2;
export const PLAYER_COUNT_MAX = 6;

export function assertPlayerCount(n: number): number {
  if (!Number.isInteger(n) || n < PLAYER_COUNT_MIN || n > PLAYER_COUNT_MAX) {
    throw new Error(
      `player count must be an integer in [${PLAYER_COUNT_MIN}, ${PLAYER_COUNT_MAX}], got ${n}`,
    );
  }
  return n;
}
