# Testing — what proves this, and what was actually run

Gate: `bash scripts/gate.sh`. Cheap tier = `tsc --noEmit && tsc -p tsconfig.web.json`
(typecheck engine + web). Full tier = `vitest run` (33 tests).

| Run | Exit | Counts | Log |
|---|---|---|---|
| bootstrap gate | 0 | 3/3 | .gate-logs/gate.log |
| engine gate (red then green) | 1 → 0 | 26/26 | .gate-logs/gate.log |
| AI + save + web gate | 0 | 33/33 | .gate-logs/gate.log |

Visual: `docs/screenshot-main.png` — headless Chrome render of `dist-web`, verified
after label/layout fixes. Browser tree killed by a `trap` in the capture script.

Pins: classic setup totals per player; reinforcement formula; continent bonus only when
fully owned; card trade escalation and validity; attack needs adjacency and 2+ armies;
fortify needs a connected own path; save round-trip and loud corrupt-save refusal;
AI plans are always legal in the real engine.

Not yet pinned: a scripted end-to-end AI-vs-human turn loop (queue row 4).
