// The AI opponent. Pure: it reads a Game and returns the moves it wants to make; it
// never mutates state. The caller applies every move through the engine, so the AI
// cannot break a rule the engine enforces (seam: AI -> ENGINE).
//
// ATTACK MODEL — this is the part that decides whether games end at all:
// one engine `attack()` call resolves exactly ONE dice round, not a whole battle. A
// turn is therefore a SEQUENCE of rounds, and a competent player rolls the dice many
// times per turn. The previous planner emitted at most four rounds, chosen from the
// first four source territories in map order, and only ever attacked once per source.
// The measured result was a permanent stall: a stack of 18229 armies in ontario sat
// adjacent to six attackable enemy territories and never swung, so games froze at a
// fixed territory split for hundreds of turns (34/8 for 700 turns, then 28/14 for
// 1300). This planner schedules up to MAX_ATTACKS rounds per turn, always choosing
// the most profitable round next, and models one expected round after each choice so
// a fight in progress is continued rather than restarted.
//
// Every planned attack is legal in the CURRENT state (the source is owned, the target
// is adjacent and enemy-held, the source keeps at least one army). The plan never
// assumes an earlier planned attack succeeded, so it stays valid if the dice disagree.

import { TERRITORIES, TERRITORY_BY_ID } from "./map.js";
import { type Game, reinforcementsFor, territoriesOf } from "./game.js";

export interface AiAttack {
  readonly from: string;
  readonly to: string;
  readonly advance: number;
}

export interface AiTurnPlan {
  readonly reinforce: readonly { territory: string; count: number }[];
  readonly attacks: readonly AiAttack[];
  readonly fortify: { from: string; to: string; count: number } | null;
}

/** Dice rounds the planner may schedule in a single turn. */
const MAX_ATTACKS = 120;

// --- dice odds --------------------------------------------------------------

const diceCache = new Map<number, number[][]>();

/** All ordered outcomes of rolling `k` dice (k <= 3, so at most 216). */
function dice(k: number): number[][] {
  const hit = diceCache.get(k);
  if (hit) return hit;
  const out: number[][] = [];
  const build = (acc: number[]): void => {
    if (acc.length === k) {
      out.push(acc);
      return;
    }
    for (let face = 1; face <= 6; face++) build([...acc, face]);
  };
  build([]);
  diceCache.set(k, out);
  return out;
}

const roundCache = new Map<string, { attacker: number; defender: number }>();

/**
 * Expected armies lost by each side in ONE dice round under the engine's rules:
 * attacker rolls min(3, armies-1) dice, defender min(2, armies), pairs compare
 * high-to-low, ties to the defender.
 */
export function expectedRoundLosses(
  attackDice: number,
  defendDice: number,
): { attacker: number; defender: number } {
  const key = `${attackDice},${defendDice}`;
  const hit = roundCache.get(key);
  if (hit) return hit;
  let attacker = 0;
  let defender = 0;
  let total = 0;
  for (const attackerRoll of dice(attackDice)) {
    for (const defenderRoll of dice(defendDice)) {
      const a = [...attackerRoll].sort((x, y) => y - x);
      const d = [...defenderRoll].sort((x, y) => y - x);
      for (let i = 0; i < Math.min(a.length, d.length); i++) {
        if (a[i]! > d[i]!) defender++;
        else attacker++; // ties favour the defender
      }
      total++;
    }
  }
  const result = { attacker: attacker / total, defender: defender / total };
  roundCache.set(key, result);
  return result;
}

// --- helpers ----------------------------------------------------------------

function enemyNeighbours(game: Game, tid: string, pid: number): string[] {
  return TERRITORY_BY_ID.get(tid)!.neighbors.filter((n) => game.owner[n] !== pid);
}

/** Territories of `pid` reachable from `from` through that player's own land. */
function connectedOwned(game: Game, pid: number, from: string): Set<string> {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const t = queue.shift()!;
    for (const n of TERRITORY_BY_ID.get(t)!.neighbors) {
      if (!seen.has(n) && game.owner[n] === pid) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

/**
 * How good a front is to hold and attack from: strongest preference for a front that
 * faces a weak enemy (that is where ground can be taken), then for danger absorbed.
 */
function frontScore(game: Game, tid: string, pid: number): number {
  const foes = enemyNeighbours(game, tid, pid);
  if (foes.length === 0) return -Infinity; // interior: not a front
  const weakest = Math.min(...foes.map((n) => game.armies[n]!));
  const threat = foes.reduce((s, n) => s + game.armies[n]!, 0);
  return -weakest * 1000 + threat;
}

// --- planning ---------------------------------------------------------------

/**
 * Spend every pending army on the biggest stack we already hold at a front. Spreading
 * reinforcements across fronts (or feeding whichever front happens to face the weakest
 * neighbour) leaves every stack too small to break the enemy's main force, which is how
 * multi-player games deadlock at a fixed territory split. A single growing stack decides
 * games; everything else holds.
 */
export function planReinforcements(game: Game): AiTurnPlan["reinforce"] {
  const pid = game.currentPlayer;
  const total = game.pendingReinforcements;
  if (total <= 0) return [];
  const mine = territoriesOf(game, pid);
  if (mine.length === 0) return [];
  let front: string | null = null;
  let bestStack = -Infinity;
  for (const t of mine) {
    if (enemyNeighbours(game, t, pid).length === 0) continue; // interior
    if (game.armies[t]! > bestStack) {
      bestStack = game.armies[t]!;
      front = t;
    }
  }
  // No border at all (fully enclosed): pile onto the biggest territory anyway.
  const target = front ?? mine.reduce((m, t) => (game.armies[t]! > game.armies[m]! ? t : m), mine[0]!);
  return [{ territory: target, count: total }];
}

/** Schedule dice rounds, best round first, until nothing profitable remains. */
export function planAttacks(game: Game): AiTurnPlan["attacks"] {
  const pid = game.currentPlayer;
  // Sources and targets are fixed to the CURRENT state, so every emitted attack is
  // legal as written. `armies`/`owner` below are only a model of how the turn unfolds.
  const sources = TERRITORIES.filter((t) => game.owner[t.id] === pid && game.armies[t.id]! >= 2).map(
    (t) => t.id,
  );
  if (sources.length === 0) return [];
  const owner: Record<string, number> = { ...game.owner };
  const armies: Record<string, number> = { ...game.armies };
  const heldBy = (p: number): number => Object.keys(game.owner).filter((k) => game.owner[k] === p).length;

  const out: AiAttack[] = [];
  for (let round = 0; round < MAX_ATTACKS; round++) {
    // A player holding a large overall advantage can profitably trade at close to even
    // odds against a concentrated defender stack, and that is the only way such a stack
    // is ever broken. Without this a 10113-army player sat behind a 1.2 : 1 local gate
    // against 4 territories holding 6751 and never finished (measured, 3p seed 2).
    const totals: Record<number, number> = {};
    for (const key of Object.keys(armies)) {
      const o = owner[key]!;
      totals[o] = (totals[o] ?? 0) + armies[key]!;
    }
    let best: { from: string; to: string; score: number } | null = null;
    for (const from of sources) {
      const a = armies[from]!;
      if (a < 2) continue;
      for (const to of TERRITORY_BY_ID.get(from)!.neighbors) {
        if (owner[to] === pid) continue; // ours already (or taken earlier this turn)
        const d = armies[to]!;
        const finishing = heldBy(owner[to]!) === 1; // taking this eliminates a player
        const dominant = (totals[pid] ?? 0) >= 1.5 * (totals[owner[to]!] ?? 0);
        // Worth it: the killing blow, swatting a lone defender, or a real dice edge.
        // The long-run break-even for 3-vs-2 dice is about 1.2 : 1, not the 2 : 1 the
        // first planner demanded.
        const edge = dominant ? 1.05 : 1.2;
        const worthIt = finishing || (d <= 1 && a >= 2) || a >= Math.ceil(d * edge) + 1;
        if (!worthIt) continue;
        // Prefer the killing blow, then hitting the WEAKEST player (eliminating players
        // one at a time is what ends a multi-player game), then the weakest defender.
        const score =
          (finishing ? 1e9 : 0) - heldBy(owner[to]!) * 10000 - d * 1000 + Math.min(a, 100);
        if (!best || score > best.score) best = { from, to, score };
      }
    }
    if (!best) break;

    const a = armies[best.from]!;
    const d = armies[best.to]!;
    // Leave the bulk of the stack where it is and move in only a holding garrison.
    // Moving half of every stack forward (the first version) spread a 4:1-superior
    // player thin while the enemy concentrated: measured, the leader held 7967 armies
    // to 6239 yet its largest stack was 1071 against the enemy's 2352, and the game
    // seesawed forever. Integer always: the engine rejects a fractional move.
    const advance = Math.max(1, Math.min(Math.floor(a) - 1, Math.max(3, Math.ceil(a / 10))));
    out.push({ from: best.from, to: best.to, advance });

    // Model one expected round so the next choice continues this fight.
    const attackDice = Math.max(1, Math.min(3, Math.floor(a) - 1));
    const defendDice = Math.max(1, Math.min(2, Math.ceil(d)));
    const loss = expectedRoundLosses(attackDice, defendDice);
    armies[best.from] = a - loss.attacker;
    armies[best.to] = d - loss.defender;
    if (armies[best.to]! <= 0) {
      owner[best.to] = pid; // do not re-target it; never chain forward from it
      armies[best.to] = advance;
      armies[best.from] = Math.max(1, armies[best.from]! - advance);
    }
  }
  return out;
}

/** One fortify move: from the largest spare reachable by land to the best front. */
export function planFortify(game: Game): AiTurnPlan["fortify"] {
  const pid = game.currentPlayer;
  const mine = territoriesOf(game, pid);
  if (mine.length < 2) return null;
  let target: string | null = null;
  let bestScore = -Infinity;
  for (const t of mine) {
    const score = frontScore(game, t, pid);
    if (score > bestScore) {
      bestScore = score;
      target = t;
    }
  }
  if (!target) return null;
  let source: string | null = null;
  let bestSpare = 0;
  for (const t of connectedOwned(game, pid, target)) {
    if (t === target) continue;
    const spare = game.armies[t]! - 1;
    if (spare > bestSpare) {
      bestSpare = spare;
      source = t;
    }
  }
  if (!source) return null;
  return { from: source, to: target, count: bestSpare };
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
