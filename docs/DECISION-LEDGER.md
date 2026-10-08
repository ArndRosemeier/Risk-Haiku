# Decision ledger — why it is like this

Append-only. One row per decision, quoting the owner verbatim where possible.

| # | Decision | Owner words / evidence | Rejected | Unproven |
|---|---|---|---|---|
| 1 | Project is a Risk-style strategy board game, TypeScript | Owner: "Board-game clone (Risk-style strategy game)", stack "Typescript, every other decision by you" | Risk-management software | Scope of the game rules (classic vs. variant) not yet chosen |
| 2 | Local git repo `main`; GitHub remote deferred | Owner: "Init new repo locally" | Pointing to an external repo | Remote not created |
| 3 | npm + tsc + vitest; no shared pnpm store | Chief-of-staff choice; host AGENTS.md says reuse shared store only for pnpm projects. npm chosen for a single-package repo. | pnpm (would also be fine) | — |
| 4 | Process scripts copied from Toolbox scaffold, unmodified | Toolbox scaffold/scripts | Hand-rolled gate | — |
