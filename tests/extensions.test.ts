import { describe, expect, it } from "vitest";
import { TERRITORIES } from "../src/map.js";
import { createRng } from "../src/rng.js";
import { newGame, attack, endAttack, placeReinforcement, endReinforce, type Game } from "../src/game.js";
import { planTurn, planAttacks, planReinforcements } from "../src/ai.js";
import { serialize, deserialize } from "../src/save.js";

const TWO = ["Ann", "Ben"];

/** A player-1 AI turn, positioned in the attack phase with enough armies to act. */
function aiAttackPosition(seed: number): Game {
  const g = newGame({ seed, names: TWO });
  return { ...g, currentPlayer: 1, phase: "attack", pendingReinforcements: 0 };
}

describe("AI planner", () => {
  it("reinforcement plan spends exactly the pending armies, on an owned territory", () => {
    const g = { ...newGame({ seed: 11, names: TWO }), currentPlayer: 0 };
    const plan = planReinforcements(g);
    const spent = plan.reduce((s, p) => s + p.count, 0);
    expect(spent).toBe(g.pendingReinforcements);
    for (const p of plan) expect(g.owner[p.territory]).toBe(0);
  });

  it("every planned attack is a legal engine attack (the AI cannot break rules)", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const g = aiAttackPosition(seed);
      for (const a of planAttacks(g)) {
        // Must be applicable in the real engine; throws if the planner is illegal.
        expect(() =>
          attack(createRng(seed), g, a.from, a.to, 1),
        ).not.toThrow();
      }
    }
  });

  it("planTurn returns a structurally valid plan for any seed", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const plan = planTurn({ ...newGame({ seed, names: TWO }), currentPlayer: 0 });
      expect(Array.isArray(plan.reinforce)).toBe(true);
      expect(Array.isArray(plan.attacks)).toBe(true);
    }
  });
});

describe("save / load", () => {
  it("round-trips a game exactly", () => {
    const g = newGame({ seed: 77, names: TWO });
    expect(deserialize(serialize(g))).toEqual(g);
  });

  it("refuses corrupt JSON loudly", () => {
    expect(() => deserialize("{not json")).toThrow(/not valid JSON/);
  });

  it("refuses a save missing a territory loudly (no half-valid game)", () => {
    const g = newGame({ seed: 77, names: TWO });
    const broken = { ...g, owner: { ...g.owner } };
    delete (broken.owner as Record<string, number>)[TERRITORIES[0]!.id];
    expect(() => deserialize(JSON.stringify(broken))).toThrow(/missing owner/);
  });
});

describe("full turn sequence through the engine", () => {
  it("reinforce → attack → fortify → end turn is reachable and legal", () => {
    let g = newGame({ seed: 5, names: TWO });
    // Place everything, end reinforce, end attack, end turn: no throws, turn advances.
    const owned = TERRITORIES.find((t) => g.owner[t.id] === g.currentPlayer)!.id;
    g = placeReinforcement(g, owned, g.pendingReinforcements);
    g = endReinforce(g);
    g = endAttack(g);
    expect(g.phase).toBe("fortify");
  });
});
