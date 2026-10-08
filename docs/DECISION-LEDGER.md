# Decision ledger — why it is like this

Append-only. One row per decision, quoting the owner verbatim where possible.

| # | Decision | Owner words / evidence | Rejected | Unproven |
|---|---|---|---|---|
| 1 | Project is a Risk-style strategy board game, TypeScript | Owner: "Board-game clone (Risk-style strategy game)", stack "Typescript, every other decision by you" | Risk-management software | Scope of the game rules (classic vs. variant) not yet chosen |
| 2 | Local git repo `main`; GitHub remote deferred | Owner: "Init new repo locally" | Pointing to an external repo | Remote not created |
| 3 | npm + tsc + vitest; no shared pnpm store | Chief-of-staff choice; host AGENTS.md says reuse shared store only for pnpm projects. npm chosen for a single-package repo. | pnpm (would also be fine) | — |
| 4 | Process scripts copied from Toolbox scaffold, unmodified | Toolbox scaffold/scripts | Hand-rolled gate | — |
| 5 | Classic 42-territory map, 6 continents, dice combat, cards, classic setup | Owner: "The base is risk" | Simplified variant | Map shapes are generated blobs (presentation only) |
| 6 | Engine is pure data: every action returns a new Game or throws loudly | House rule 1 (no silent fallbacks) | Mutable state | — |
| 7 | AI is a heuristic planner; it can only act through the engine | Keeps AI unable to break rules | AI with privileged state access | Heuristic attack logic is rough; legality is enforced, quality is not |
| 8 | Hero web UI = SVG map + Vite; UI contains no rules | Owner: "should be a hero web ui" | Canvas / game framework | Visual polish is subjective |
| 9 | Extensions: AI opponent, save/load (localStorage JSON), card trading | Owner: "expand and extend" | — | Fog-of-war and scenarios not built |
| 10 | The AI schedules a long sequence of dice rounds per turn (up to 120), each legal in the state as it stands | `attack()` resolves ONE dice round. The old planner emitted <=4 attacks/turn from the first four sources in map order, so a 18229-army stack sat next to six attackable territories and never swung; games froze for 700+ turns. Evidence: two-player 0/12 → 12/12 | A chained "blitz" plan that assumes earlier rounds won; one attack per source per turn | The optimal round budget per turn |
| 11 | Attack gate is the real 3-vs-2 break-even (~1.2:1, relaxed to ~1.05:1 when dominant overall), not 2:1 | Evidence: with a 2:1 gate a player holding 4x the enemy's armies could not engage a single enemy stack, and stalled at 39 territories vs 3 (seed 4) | The 2:1 "guaranteed win" gate | Exact break-even once stacks are large |
| 12 | Concentrate force: reinforce the biggest front stack; advance only a holding garrison (~10%) on conquest | Evidence: advancing half of every stack spread a 7967-army leader until its largest stack (1071) was smaller than the enemy's (2352), and the game seesawed forever | Spreading reinforcements across fronts; moving the whole stack forward | Optimal garrison size |
| 13 | Two-player convergence is ASSERTED; multi-player convergence is reported, not claimed | Evidence: 3p 5/6 and 4p 1/4 at a 600-turn cap; a balanced multi-way melee can deadlock, as in table Risk | Claiming every game ends | A strategy that reliably breaks a 3- or 4-way deadlock |
