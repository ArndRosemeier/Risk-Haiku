# The board — what is happening right now

reconciled: 31742d0 · 2026-10-08T08:21Z

SESSION | id=chief-of-staff | model=deepseek-harness | state=idle

LANDED | row=2 | sha=31742d0 | verify=MY OWN: full gate GREEN exit 0, 26/26 · engine core
  (map, combat, cards, turns) | note=engine; starting-armies defect caught by gate and fixed
LANDED | row=3 | sha=eab8d82 | verify=MY OWN: full gate GREEN exit 0, 33/33 · web typecheck
  in cheap tier · vite build OK · headless screenshot verified | note=AI, save/load, hero UI

QUEUE | row=4 | Turn-loop playtest (AI vs human end-to-end, scripted) | src=docs/TESTING.md
QUEUE | row=5 | Trade-cards UI: let player pick the 3 cards (currently fixed indices 0-2) | src=web/main.ts

RECOVERY | repo=/home/administrator/Risk | remote=none (GitHub deferred by owner) | branch=main | gate=bash scripts/gate.sh

## Guards

- `GUARD` — the suite lock: `scripts/gate.sh` takes an atomic mkdir lock; a second
  run exits 9 and is VOID. Verify: run a gate twice.

## Traps

- `TRAP` — starting armies were distributed globally, not per player (each got ~15).
  Rule: pin per-player totals against the classic table, not the global sum. Caught by gate.
- `TRAP` — a conditional test (`if (far) expect...`) could pass vacuously. Rule: no
  conditional assertions; build the state deterministically.
