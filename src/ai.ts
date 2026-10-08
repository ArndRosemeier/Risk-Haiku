// A heuristic AI opponent. Pure: it reads a Game and returns the moves it wants to
// make; it never mutates state. The caller applies moves through the engine, so the
// AI can never break a rule the engine enforces (seam: AI → ENGINE).

import { TERRITORIES, TERRITORY_BY_ID } from "./map.js";
import { type Game, reinforcementsFor, territoriesOf } from "./game.js";

export interface AiTurnPlan {
  readonly reinforce: readonly { territory: string; count: number }[];
  readonly attacks: readonly { from: string; to: string }[];
  readonly fortify: { from: string; to: string; count: number } | null;
}

/** Threat = enemy armies adjacent to a territory the player owns. */
function threatAt(game: Game, tid: string, pid: number): number {
  return TERRITORY_BY_ID.get(tid)!.neighbors
    .filter((n) => game.owner[n] !== pid)
    .reduce((s, n) => s + game.armies[n]!, 0);
}

/** Plan reinforcements: spend everything on the most threatened border territories. */
export function planReinforcements(game: Game): AiTurnPlan["reinforce"] {
  const pid = game.currentPlayer;
  const total = game.pendingReinforcements;
  if (total <= 0) return [];
  const borders = territoriesOf(game, pid)
    .map((t) => ({ t, threat: threatAt(game, t, pid) }))
    .filter((x) => x.threat > 0)
    .sort((a, b) => b.threat - a.threat);
  const pool = borders.length ? borders : territoriesOf(game, pid).map((t) => ({ t, threat: 0 }));
  // Put everything on the single most threatened border; ties resolve by list order.
  return [{ territory: pool[0]!.t, count: total }];
}

/** Attack when the odds look good: attacker has clearly more armies than the defender. */
export function planAttacks(game: Game): AiTurnPlan["attacks"] {
  const pid = game.currentPlayer;
  const attacks: { from: string; to: string }[] = [];
  const armies = { ...game.armies };
  for (const t of TERRITORIES) {
    if (game.owner[t.id] !== pid) continue;
    for (const n of t.neighbors) {
      if (game.owner[n] === pid) continue;
      // Attack only with a clear advantage: keep this many or more armies in reserve.
      if (armies[t.id]! >= armies[n]! * 2 + 1 && armies[t.id]! >= 3) {
        attacks.push({ from: t.id, to: n });
        // Account for the assumed outcome so later picks stay consistent.
        armies[t.id] = armies[t.id]! - 1;
        armies[n] = Math.max(1, armies[n]! - Math.floor(armies[t.id]! / 3));
        break;
      }
    }
    if (attacks.length >= 4) break; // keep a turn short and readable
  }
  return attacks;
}

/** Fortify: move surplus from the safest interior territory toward the most threatened border. */
export function planFortify(game: Game): AiTurnPlan["fortify"] {
  const pid = game.currentPlayer;
  const mine = territoriesOf(game, pid);
  let best: { from: string; to: string; count: number; score: number } | null = null;
  for (const from of mine) {
    if (threatAt(game, from, pid) > 0) continue; // only move from interior
    const spare = game.armies[from]! - 1;
    if (spare < 1) continue;
    for (const to of TERRITORY_BY_ID.get(from)!.neighbors) {
      if (game.owner[to] !== pid) continue;
      const score = threatAt(game, to, pid);
      if (score > 0 && (!best || score > best.score)) {
        best = { from, to, count: spare, score };
      }
    }
  }
  return best ? { from: best.from, to: best.to, count: best.count } : null;
}

export function planTurn(game: Game): AiTurnPlan {
  return {
    reinforce: planReinforcements(game),
    attacks: planAttacks(game),
    fortify: planFortify(game),
  };
}

/** Expose for tests: the armies the engine would give this player this turn. */
export function expectedReinforcements(game: Game): number {
  return reinforcementsFor(game, game.currentPlayer);
}
