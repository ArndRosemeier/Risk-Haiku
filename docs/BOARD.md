# The board — what is happening right now

reconciled: 79c33ab · 2026-10-08T10:02Z

SESSION | id=chief-of-staff | model=deepseek-harness | state=idle

LANDED | row=2 | sha=31742d0 | verify=MY OWN: full gate GREEN exit 0, 26/26 · engine core
  (map, combat, cards, turns) | note=engine; starting-armies defect caught by gate and fixed
LANDED | row=3 | sha=eab8d82 | verify=MY OWN: full gate GREEN exit 0, 33/33 · web typecheck
  in cheap tier · vite build OK · headless screenshot verified | note=AI, save/load, hero UI
LANDED | row=4 | sha=79c33ab | verify=MY OWN: full gate GREEN exit 0, 39/39 · two-player
  convergence ASSERTED (8 seeds, 250-turn cap) · measured before/after on the same seeds:
  2p 0/12 -> 12/12, 3p 0/8 -> 5/6, 4p 0/6 -> 1/4 · vite build OK
  | note=AI attack rewrite; the old planner rolled dice <=4x per turn and games never ended

QUEUE | row=5 | Trade-cards UI: let player pick the 3 cards (currently fixed indices 0-2) | src=web/main.ts
QUEUE | row=6 | Multi-player convergence: 3p 5/6, 4p 1/4 — break the balanced-melee deadlock | src=src/ai.ts

RECOVERY | repo=/home/administrator/Risk | remote=https://github.com/ArndRosemeier/Risk-Haiku.git | branch=main | gate=bash scripts/gate.sh

## Guards

- `GUARD` — the suite lock: `scripts/gate.sh` takes an atomic mkdir lock; a second
  run exits 9 and is VOID. Verify: run a gate twice.
- `GUARD` — two-player convergence is pinned in `tests/playthrough.test.ts`. If an AI
  change makes games stop ending, that test fails loudly instead of the suite staying
  green on a game that can never finish.

## Traps

- `TRAP` — starting armies were distributed globally, not per player (each got ~15).
  Rule: pin per-player totals against the classic table, not the global sum. Caught by gate.
- `TRAP` — a conditional test (`if (far) expect...`) could pass vacuously. Rule: no
  conditional assertions; build the state deterministically.
- `TRAP` — an assertion that cannot fail is worse than no assertion. A drafted
  "conservation" check read `expect(x).toBe(x)`; it was replaced by a real invariant
  (an alive player must hold land). Rule: every assertion must have a failing case.
- `TRAP` — a green suite proved nothing about whether games END: 33/33 passed while the
  AI could never finish a game. Rule: assert the outcome the user cares about, not just
  that nothing throws.
- `TRAP` — a measurement taken from several harness copies writing one log file read as
  "empty result". Rule: one writer per log; capture PIDs in one call and kill them in a
  separate call (never pattern-kill from the shell that contains the pattern).
