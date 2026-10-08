// Deterministic, seedable PRNG (mulberry32). Every random outcome in the engine
// comes from one of these, so a game is fully reproducible from its seed.

export interface Rng {
  next(): number; // [0, 1)
  int(maxExclusive: number): number; // [0, maxExclusive)
  shuffle<T>(items: readonly T[]): T[];
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) throw new Error(`rng seed must be an integer, got ${seed}`);
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`int() bound must be a positive integer, got ${maxExclusive}`);
      }
      return Math.floor(next() * maxExclusive);
    },
    shuffle<T>(items: readonly T[]): T[] {
      const a = items.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
  };
}
