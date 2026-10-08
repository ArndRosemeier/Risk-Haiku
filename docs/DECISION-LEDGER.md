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
