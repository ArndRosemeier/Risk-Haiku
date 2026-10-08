# Seam index — where is the ONE way to do X

| Seam | Location | Note |
|---|---|---|
| Map topology & continents | `src/map.ts` (`TERRITORIES`, `CONTINENTS`, `validateMap`) | Only place adjacency is defined |
| Player-count validation | `src/index.ts` `assertPlayerCount` | |
| RNG | `src/rng.ts` `createRng` | All randomness flows through it (reproducible seeds) |
| Dice combat | `src/combat.ts` `resolveBattle` | Only place a battle is resolved |
| Game state transitions | `src/game.ts` | Every rule change goes here; UI and AI call these |
| Card set validity | `src/game.ts` `isValidSet` | Single source for trade validity |
| AI planning | `src/ai.ts` `planTurn` | Pure; output is applied through the engine |
| Save/load | `src/save.ts` `serialize` / `deserialize` | Loud validation on load |
| UI | `web/main.ts` | Renders engine state; no rules |

Gotchas: `attack` auto-advances `armies-1` on conquest in the UI (simplification).
Known debt: UI trade-cards uses fixed indices 0–2 (queue row 5).
