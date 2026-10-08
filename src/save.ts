// Save/load: a Game is plain JSON. Loading validates the shape loudly — a corrupt
// save fails the load, it never produces a half-valid game (house rule 3).

import { TERRITORIES } from "./map.js";
import type { Game } from "./game.js";

export function serialize(game: Game): string {
  return JSON.stringify(game);
}

export function deserialize(text: string): Game {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`save data is not valid JSON: ${(e as Error).message}`);
  }
  const g = raw as Partial<Game> | null;
  if (!g || typeof g !== "object") throw new Error("save data is not an object");
  if (!Array.isArray(g.players) || g.players.length < 2) throw new Error("save has no players");
  if (!g.owner || !g.armies) throw new Error("save is missing owner/armies");
  for (const t of TERRITORIES) {
    if (!(t.id in g.owner)) throw new Error(`save is missing owner for ${t.id}`);
    if (!(t.id in g.armies)) throw new Error(`save is missing armies for ${t.id}`);
  }
  if (!["reinforce", "attack", "fortify", "over"].includes(g.phase as string)) {
    throw new Error(`save has unknown phase ${String(g.phase)}`);
  }
  return g as Game;
}
