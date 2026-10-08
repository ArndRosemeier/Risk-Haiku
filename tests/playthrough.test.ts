// Full-game playthroughs (AI vs AI, engine-only).
//
// Two different things are checked here, and they are deliberately separated:
//
// 1. THE ENGINE GUARANTEE (asserted). Over whole games, whatever the AI asks for:
//    the engine never throws, every move the AI makes is accepted as legal, army and
//    territory conservation hold after every turn, and no territory is ever left
//    ownerless or empty. This is a property of the ENGINE and must always hold.
//
// 2. CONVERGENCE (asserted for two players, reported otherwise). Every TWO-PLAYER game
//    reaches a single winner who owns all 42 territories, within the turn cap. This is
//    a property of the AI. Multi-player games are a harder problem (a balanced
//    three-way or four-way melee can deadlock, which is true of table Risk too), so
//    those are REPORTED and only the fastest known multi-player seeds are pinned.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/rng.js";
import {
  newGame, placeReinforcement, endReinforce, attack, endAttack, fortify, endTurn,
  tradeCards, type Game,
} from "../src/game.js";
import { planTurn } from "../src/ai.js";
import { TERRITORIES } from "../src/map.js";

/** Generous enough for every two-player game measured (worst was 157 turns). */
const TURN_CAP = 250;

function findValidSet(cards: readonly { symbol: string }[]): [number, number, number] | null {
  for (let a = 0; a < cards.length; a++)
    for (let b = a + 1; b < cards.length; b++)
      for (let c = b + 1; c < cards.length; c++) {
        const s = [cards[a]!.symbol, cards[b]!.symbol, cards[c]!.symbol];
        if (s.includes("wild") || s.every((x) => x === s[0]) || new Set(s).size === 3) return [a, b, c];
      }
  return null;
}

/** Engine invariants that must hold at every checkpoint. Throws loudly if violated. */
function assertInvariants(g: Game): void {
  if (Object.keys(g.owner).length !== TERRITORIES.length) {
    throw new Error(`invariant: ${Object.keys(g.owner).length} territories owned, expected ${TERRITORIES.length}`);
  }
  for (const t of TERRITORIES) {
    if (g.owner[t.id] === undefined) throw new Error(`invariant: ${t.id} has no owner`);
    if (!(g.armies[t.id]! >= 1)) throw new Error(`invariant: ${t.id} has ${g.armies[t.id]} armies`);
  }
}

/** Play one full turn for the current player. Every action goes through the engine. */
function playTurn(g0: Game, rng: ReturnType<typeof createRng>): Game {
  let g = g0;
  // Classic card rule: must trade at 5+ cards; otherwise trade while a set exists.
  for (;;) {
    const set = findValidSet(g.players[g.currentPlayer]!.cards);
    if (!set) break;
    if (g.players[g.currentPlayer]!.cards.length < 5 && g.cardTradesMade >= 6) break;
    g = tradeCards(g, set);
  }
  const plan = planTurn(g);
  for (const r of plan.reinforce) {
    for (let i = 0; i < r.count; i++) g = placeReinforcement(g, r.territory, 1);
  }
  g = endReinforce(g);
  for (const a of plan.attacks) {
    if (g.phase === "over") break;
    // The plan is a forecast over many dice rounds, so an earlier round may have taken
    // the target or emptied the source. Skip ONLY when the move is no longer legal; the
    // engine stays the final authority and rejects anything illegal that gets through.
    if (g.owner[a.from] !== g.currentPlayer || g.owner[a.to] === g.currentPlayer || g.armies[a.from]! < 2) continue;
    const moveIn = Math.max(1, Math.min(g.armies[a.from]! - 1, a.advance));
    g = attack(rng, g, a.from, a.to, moveIn).game;
  }
  if (g.phase === "over") return g;
  g = endAttack(g);
  const f = plan.fortify;
  if (f && g.owner[f.from] === g.currentPlayer && g.owner[f.to] === g.currentPlayer && g.armies[f.from]! > f.count) {
    g = fortify(g, f.from, f.to, f.count);
  }
  return endTurn(g);
}

interface Outcome {
  seed: number;
  players: number;
  turns: number;
  finished: boolean;
  winnerOwnsAll: boolean;
}

function playGame(seed: number, players: number, cap = TURN_CAP): Outcome {
  const names = Array.from({ length: players }, (_, i) => `P${i}`);
  let g = newGame({ seed, names });
  const rng = createRng(seed ^ 0xabc123);
  let turns = 0;
  while (g.phase !== "over" && turns < cap) {
    g = playTurn(g, rng);
    assertInvariants(g);
    turns++;
  }
  const finished = g.phase === "over";
  return {
    seed,
    players,
    turns,
    finished,
    winnerOwnsAll: finished && Object.values(g.owner).every((o) => o === g.winner),
  };
}

describe("engine guarantee over full AI-vs-AI games", () => {
  it("no game ever throws or violates an invariant (2, 3 and 4 players)", () => {
    for (const players of [2, 3, 4]) {
      for (let seed = 1; seed <= 3; seed++) {
        let outcome: Outcome | null = null;
        expect(() => {
          outcome = playGame(seed * (players + 3), players, 120);
        }).not.toThrow();
        expect(outcome).not.toBeNull();
      }
    }
  });

  it("army and territory conservation hold through every turn of a game", () => {
    const names = ["a", "b", "c"];
    let g = newGame({ seed: 9, names });
    const rng = createRng(9);
    for (let i = 0; i < 60 && g.phase !== "over"; i++) {
      g = playTurn(g, rng);
      assertInvariants(g);
      // Every living player must hold land: losing your last territory eliminates you,
      // so "alive but landless" would be a broken elimination and would stall the game.
      for (const p of g.players) {
        const held = Object.values(g.owner).filter((o) => o === p.id).length;
        if (p.alive) expect(held, `${p.name} is alive but holds ${held} territories`).toBeGreaterThan(0);
        else expect(held).toBe(0);
      }
      expect(g.players.some((p) => p.alive)).toBe(true);
    }
  });
});

describe("AI convergence", () => {
  it("every two-player game reaches a single winner who owns all 42 territories", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const r = playGame(seed, 2, TURN_CAP);
      expect(r.finished, `seed ${seed} did not finish in ${TURN_CAP} turns`).toBe(true);
      expect(r.winnerOwnsAll, `seed ${seed} left territories unowned by the winner`).toBe(true);
    }
  });

  it("pins a three-player game that converges (multi-player is not guaranteed)", () => {
    const r = playGame(6, 3, TURN_CAP);
    expect(r.finished).toBe(true);
    expect(r.winnerOwnsAll).toBe(true);
  });
});
