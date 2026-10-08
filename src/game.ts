// The game engine: pure state transitions. A Game is plain data; every action
// returns a new Game or throws a LOUD error. No silent fallbacks (house rule 1).
//
// Turn phases: reinforce → attack* → fortify → (end turn). Cards are earned on
// conquest and traded in during reinforce for bonus armies.

import { TERRITORIES, TERRITORY_BY_ID, CONTINENTS, validateMap } from "./map.js";
import { createRng, type Rng } from "./rng.js";
import { resolveBattle, maxAttackDice, maxDefendDice, type CombatResult } from "./combat.js";

export type Phase = "reinforce" | "attack" | "fortify" | "over";
export type CardSymbol = "infantry" | "cavalry" | "artillery" | "wild";

export interface Card {
  readonly territory: string | null; // null for wild
  readonly symbol: CardSymbol;
}

export interface Player {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly alive: boolean;
  readonly cards: readonly Card[];
}

export interface Game {
  readonly seed: number;
  readonly players: readonly Player[];
  readonly owner: Readonly<Record<string, number>>; // territory id -> player id
  readonly armies: Readonly<Record<string, number>>; // territory id -> armies
  readonly deck: readonly Card[];
  readonly discard: readonly Card[];
  readonly currentPlayer: number;
  readonly phase: Phase;
  readonly pendingReinforcements: number;
  readonly turn: number;
  readonly conqueredThisTurn: boolean;
  readonly cardTradesMade: number;
  readonly winner: number | null;
  readonly log: readonly string[];
}

export const STARTING_ARMIES: Readonly<Record<number, number>> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };
export const PLAYER_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#eab308", "#9333ea", "#f97316"] as const;
export const DEFAULT_NAMES = ["Red", "Blue", "Green", "Gold", "Violet", "Orange"] as const;

// Card-trade values: 4,6,8,10,12,15 then +5 each.

export function cardTradeValue(tradesAlreadyMade: number): number {
  const table = [4, 6, 8, 10, 12, 15];
  if (tradesAlreadyMade < table.length) return table[tradesAlreadyMade]!;
  return 15 + 5 * (tradesAlreadyMade - (table.length - 1));
}

export function continentBonus(game: Game, playerId: number): number {
  let bonus = 0;
  for (const c of CONTINENTS) {
    const owned = c.territories.every((t) => game.owner[t] === playerId);
    if (owned) bonus += c.bonus;
  }
  return bonus;
}

export function reinforcementsFor(game: Game, playerId: number): number {
  const owned = Object.values(game.owner).filter((p) => p === playerId).length;
  return Math.max(3, Math.floor(owned / 3)) + continentBonus(game, playerId);
}

function requireMutable(game: Game, action: string): void {
  if (game.phase === "over") throw new Error(`${action}: the game is over`);
}

function buildDeck(rng: Rng): Card[] {
  const symbols: CardSymbol[] = ["infantry", "cavalry", "artillery"];
  const cards: Card[] = TERRITORIES.map((t, i) => ({ territory: t.id, symbol: symbols[i % 3]! }));
  cards.push({ territory: null, symbol: "wild" }, { territory: null, symbol: "wild" });
  return rng.shuffle(cards);
}

export interface NewGameOptions {
  readonly seed: number;
  readonly names: readonly string[];
}

/** Deal territories round-robin and place starting armies. Loud on bad input. */
export function newGame(opts: NewGameOptions): Game {
  validateMap();
  const n = opts.names.length;
  if (!Number.isInteger(n) || n < 2 || n > 6) throw new Error(`need 2..6 players, got ${n}`);
  const rng = createRng(opts.seed);
  const order = rng.shuffle(TERRITORIES.map((t) => t.id));
  const owner: Record<string, number> = {};
  const armies: Record<string, number> = {};
  order.forEach((tid, i) => {
    owner[tid] = i % n;
    armies[tid] = 1;
  });
  const players: Player[] = opts.names.map((name, id) => ({
    id,
    name,
    color: PLAYER_COLORS[id]!,
    alive: true,
    cards: [],
  }));
  // Each player's TOTAL starting armies equals the classic table value for this
  // player count. Each player already holds some territories (one army each); the
  // remainder is placed one at a time on random territories they own.
  const total = STARTING_ARMIES[n]!;
  for (let pid = 0; pid < n; pid++) {
    const ts = order.filter((t) => owner[t] === pid);
    let budget = total - ts.length;
    if (budget < 0) throw new Error(`player ${pid} holds more territories than starting armies allow`);
    while (budget > 0) {
      armies[ts[rng.int(ts.length)]!]! += 1;
      budget--;
    }
  }
  const game: Game = {
    seed: opts.seed,
    players,
    owner,
    armies,
    deck: buildDeck(rng),
    discard: [],
    currentPlayer: 0,
    phase: "reinforce",
    pendingReinforcements: 0,
    turn: 1,
    conqueredThisTurn: false,
    cardTradesMade: 0,
    winner: null,
    log: ["Game started."],
  };
  return { ...game, pendingReinforcements: reinforcementsFor(game, 0) };
}

/**
 * A valid set: three of a kind, one of each symbol, or any set containing a wild.
 * Pure function of the three cards — the single source of truth for set validity.
 */
export function isValidSet(cards: readonly Card[]): boolean {
  if (cards.length !== 3) return false;
  if (cards.some((c) => c.symbol === "wild")) return true;
  const syms = cards.map((c) => c.symbol);
  const allSame = syms.every((s) => s === syms[0]);
  const allDiff = new Set(syms).size === 3;
  return allSame || allDiff;
}

/** Trade exactly three cards for bonus armies. Enforces the valid-set rules. */
export function tradeCards(game: Game, cardIdx: readonly number[]): Game {
  requireMutable(game, "tradeCards");
  if (game.phase !== "reinforce") throw new Error("tradeCards: only allowed during reinforce");
  const p = game.players[game.currentPlayer]!;
  if (cardIdx.length !== 3) throw new Error("tradeCards: exactly 3 cards required");
  if (new Set(cardIdx).size !== 3) throw new Error("tradeCards: card indices must be distinct");
  const picked = cardIdx.map((i) => {
    const c = p.cards[i];
    if (!c) throw new Error(`tradeCards: no card at index ${i}`);
    return c;
  });
  if (!isValidSet(picked)) throw new Error("tradeCards: the three cards do not form a valid set");

  // Auto-bonus: owning a territory shown on a traded card grants +2 armies there.
  const bonusTargets = picked
    .map((c) => c.territory)
    .filter((t): t is string => t !== null && game.owner[t] === game.currentPlayer);
  const value = cardTradeValue(game.cardTradesMade);
  const remaining = p.cards.filter((_, i) => !cardIdx.includes(i));
  const players = game.players.map((q) => (q.id === p.id ? { ...q, cards: remaining } : q));
  const armies = { ...game.armies };
  for (const t of bonusTargets) armies[t] = armies[t]! + 2;
  return {
    ...game,
    players,
    armies,
    discard: [...game.discard, ...picked],
    pendingReinforcements: game.pendingReinforcements + value,
    cardTradesMade: game.cardTradesMade + 1,
    log: [...game.log, `${p.name} traded cards for ${value} armies.`],
  };
}

export function placeReinforcement(game: Game, territory: string, count: number): Game {
  requireMutable(game, "placeReinforcement");
  if (game.phase !== "reinforce") throw new Error("placeReinforcement: wrong phase");
  if (!TERRITORY_BY_ID.has(territory)) throw new Error(`unknown territory ${territory}`);
  if (game.owner[territory] !== game.currentPlayer) throw new Error(`${territory} is not yours`);
  if (!Number.isInteger(count) || count < 1) throw new Error(`count must be a positive integer, got ${count}`);
  if (count > game.pendingReinforcements) {
    throw new Error(`only ${game.pendingReinforcements} reinforcements left, tried ${count}`);
  }
  return {
    ...game,
    armies: { ...game.armies, [territory]: game.armies[territory]! + count },
    pendingReinforcements: game.pendingReinforcements - count,
  };
}

/** Reinforce phase ends only when every army has been placed. */
export function endReinforce(game: Game): Game {
  requireMutable(game, "endReinforce");
  if (game.phase !== "reinforce") throw new Error("endReinforce: wrong phase");
  if (game.pendingReinforcements > 0) {
    throw new Error(`${game.pendingReinforcements} reinforcements still unplaced`);
  }
  return { ...game, phase: "attack" };
}

export interface AttackOutcome {
  readonly game: Game;
  readonly combat: CombatResult;
  readonly conquered: boolean;
}

/** Attack one adjacent territory. If it is conquered, `moveIn` armies advance. */
export function attack(rng: Rng, game: Game, from: string, to: string, moveIn?: number): AttackOutcome {
  requireMutable(game, "attack");
  if (game.phase !== "attack") throw new Error("attack: wrong phase");
  const fromDef = TERRITORY_BY_ID.get(from);
  const toDef = TERRITORY_BY_ID.get(to);
  if (!fromDef || !toDef) throw new Error(`attack: unknown territory ${from} or ${to}`);
  if (game.owner[from] !== game.currentPlayer) throw new Error(`${from} is not yours`);
  if (game.owner[to] === game.currentPlayer) throw new Error(`${to} is already yours`);
  if (!fromDef.neighbors.includes(to)) throw new Error(`${from} is not adjacent to ${to}`);

  const combat = resolveBattle(
    rng,
    maxAttackDice(game.armies[from]!),
    maxDefendDice(game.armies[to]!),
  );
  const armies = { ...game.armies };
  armies[from] = armies[from]! - combat.attackerLosses;
  armies[to] = armies[to]! - combat.defenderLosses;
  const defenderOwner = game.owner[to]!;
  let owner = { ...game.owner };
  let conquered = false;
  let players = game.players;
  let deck = game.deck;
  let winner = game.winner;
  let phase: Phase = game.phase;
  let conqueredThisTurn = game.conqueredThisTurn;
  let logLine = `${fromDef.name} → ${toDef.name}: lost ${combat.attackerLosses}, killed ${combat.defenderLosses}.`;

  if (armies[to]! <= 0) {
    conquered = true;
    const advance = moveIn ?? 0;
    if (!Number.isInteger(advance) || advance < 1 || advance > armies[from]! - 1) {
      throw new Error(`moveIn must be between 1 and ${armies[from]! - 1}, got ${advance}`);
    }
    armies[from] = armies[from]! - advance;
    armies[to] = advance;
    owner[to] = game.currentPlayer;
    conqueredThisTurn = true;
    logLine += ` ${toDef.name} conquered.`;

    // Eliminated? Take their cards.
    const stillHolds = Object.values(owner).some((p) => p === defenderOwner);
    if (!stillHolds) {
      const loser = game.players[defenderOwner]!;
      const winnerP = game.players[game.currentPlayer]!;
      players = game.players.map((p) => {
        if (p.id === defenderOwner) return { ...p, alive: false, cards: [] };
        if (p.id === winnerP.id) return { ...p, cards: [...p.cards, ...loser.cards] };
        return p;
      });
      logLine += ` ${loser.name} is eliminated!`;
    }
    const alive = players.filter((p) => p.alive);
    if (alive.length === 1) {
      winner = alive[0]!.id;
      phase = "over";
      logLine += ` ${alive[0]!.name} conquers the world.`;
    }
  }

  // Award one card per turn, on the first conquest. When the deck is empty the
  // discard pile is reshuffled into a new deck (classic rule). Only if BOTH piles are
  // empty is no card awarded — a legal state, not an error.
  let discard = game.discard;
  if (conquered && !game.conqueredThisTurn && phase !== "over") {
    if (deck.length === 0 && discard.length > 0) {
      deck = rng.shuffle(discard);
      discard = [];
    }
    if (deck.length > 0) {
      const card = deck[0]!;
      deck = deck.slice(1);
      players = players.map((p) => (p.id === game.currentPlayer ? { ...p, cards: [...p.cards, card] } : p));
    }
  }

  const next: Game = {
    ...game,
    armies,
    owner,
    players,
    deck,
    discard,
    phase,
    winner,
    conqueredThisTurn,
    log: [...game.log, logLine],
  };
  return { game: next, combat, conquered };
}

/** Stop attacking and move to fortify. */
export function endAttack(game: Game): Game {
  requireMutable(game, "endAttack");
  if (game.phase !== "attack") throw new Error("endAttack: wrong phase");
  return { ...game, phase: "fortify" };
}

/** One optional fortify move per turn: leave at least 1 army behind. */
export function fortify(game: Game, from: string, to: string, count: number): Game {
  requireMutable(game, "fortify");
  if (game.phase !== "fortify") throw new Error("fortify: wrong phase");
  const fromDef = TERRITORY_BY_ID.get(from);
  if (!fromDef || !TERRITORY_BY_ID.has(to)) throw new Error(`fortify: unknown territory`);
  if (game.owner[from] !== game.currentPlayer || game.owner[to] !== game.currentPlayer) {
    throw new Error("fortify: both territories must be yours");
  }
  if (!connectedThrough(game, game.currentPlayer, from, to)) {
    throw new Error(`fortify: ${from} and ${to} are not connected through your territories`);
  }
  if (!Number.isInteger(count) || count < 1 || count > game.armies[from]! - 1) {
    throw new Error(`fortify: count must be 1..${game.armies[from]! - 1}, got ${count}`);
  }
  const armies = { ...game.armies, [from]: game.armies[from]! - count, [to]: game.armies[to]! + count };
  return { ...game, armies, log: [...game.log, `${game.players[game.currentPlayer]!.name} fortified ${TERRITORY_BY_ID.get(to)!.name}.`] };
}

function connectedThrough(game: Game, pid: number, a: string, b: string): boolean {
  const seen = new Set<string>([a]);
  const queue = [a];
  while (queue.length) {
    const t = queue.shift()!;
    if (t === b) return true;
    for (const n of TERRITORY_BY_ID.get(t)!.neighbors) {
      if (!seen.has(n) && game.owner[n] === pid) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

/** End the turn: award a card if we conquered (already done on conquest), pass play on. */
export function endTurn(game: Game): Game {
  requireMutable(game, "endTurn");
  if (game.phase !== "fortify") throw new Error("endTurn: wrong phase");
  const n = game.players.length;
  let next = (game.currentPlayer + 1) % n;
  while (!game.players[next]!.alive) next = (next + 1) % n;
  const nextGame: Game = {
    ...game,
    currentPlayer: next,
    phase: "reinforce",
    turn: next <= game.currentPlayer ? game.turn + 1 : game.turn,
    conqueredThisTurn: false,
    pendingReinforcements: 0,
    log: [...game.log, `${game.players[next]!.name}'s turn.`],
  };
  return { ...nextGame, pendingReinforcements: reinforcementsFor(nextGame, next) };
}

export function territoriesOf(game: Game, pid: number): string[] {
  return TERRITORIES.filter((t) => game.owner[t.id] === pid).map((t) => t.id);
}

export function totalArmies(game: Game, pid: number): number {
  return territoriesOf(game, pid).reduce((s, t) => s + game.armies[t]!, 0);
}
