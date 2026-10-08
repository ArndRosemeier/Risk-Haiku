# Testing — what proves this, and what was actually run

Gate: `bash scripts/gate.sh`. Cheap tier = `tsc --noEmit && tsc -p tsconfig.web.json`
(typecheck engine + web). Full tier = `vitest run` (39 tests). Never pipe a gate through
`tail`/`head`: it hides the failing case and the pipeline's exit code is the last
command's. Read the raw log in `.gate-logs/`.

| Run | Exit | Counts | Log |
|---|---|---|---|
| bootstrap gate | 0 | 3/3 | .gate-logs/gate.log |
| engine gate (red then green) | 1 → 0 | 26/26 | .gate-logs/gate.log |
| AI + save + web gate | 0 | 33/33 | .gate-logs/gate.log |
| discard-reshuffle fix + playthroughs | 0 | 39/39 | .gate-logs/gate.log |
| AI attack rewrite | 0 | 39/39 | .gate-logs/gate.log |

## AI convergence — the measurement that decides whether the game ends

One `attack()` call resolves ONE dice round, so a turn is a *sequence* of rounds. Whether
a game ends is therefore a property of the planner, and it is measured by playing seeded
AI-vs-AI games through the engine only. Before the rewrite (`fd4e102`) versus after
(`79c33ab`), same seeds, 400–600 turn cap:

| players | before | after | finishing turns (after) |
|---|---|---|---|
| 2 | 0/12 | **12/12** | 21–157 |
| 3 | 0/8 | **5/6** | 66–409 |
| 4 | 0/6 | **1/4** | 248 |

Two-player convergence is ASSERTED in `tests/playthrough.test.ts` (seeds 1–8, 250-turn
cap), together with "the winner owns all 42 territories". One converging three-player
seed is pinned. Multi-player convergence is reported, not claimed: a balanced three- or
four-way melee can deadlock, which is equally true of table Risk.

Method note: the convergence harness was a temporary file compiled out-of-tree
(`npx tsc src/diag.ts --outDir /tmp/rb ...`) and run with plain `node`, so its output
could not be clobbered by concurrent runs. It is deleted; the shipped guarantee now
lives in the suite. Every "before" number above came from running the *committed* AI
over the same seeds, not from memory.

## Engine guarantee (asserted over whole games)

No game throws, every move the AI asks for is accepted as legal, and after every turn all
42 territories are owned and hold at least one army. Also asserted: every *alive* player
holds land (losing your last territory eliminates you, so "alive but landless" would stall
the game forever).

## Pins

Classic setup totals per player; reinforcement formula; continent bonus only when fully
owned; card trade escalation and validity; attack needs adjacency and 2+ armies; fortify
needs a connected own path; an exhausted deck reshuffles the discard pile instead of
throwing; save round-trip and loud corrupt-save refusal; every AI-planned attack is legal
in the real engine; two-player games converge to one winner who owns the board.

## Visual

`docs/screenshot-main.png` — headless Chrome render of `dist-web`. The browser process
tree is killed by a `trap` in the capture script (a headless browser is a tree, not a
process).
