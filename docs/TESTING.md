# Testing — what proves this, and what was actually run

Gate: `bash scripts/gate.sh` (cheap tier = `tsc --noEmit`; full tier = `vitest run`).

| Run | Exit | Counts | Log |
|---|---|---|---|
| bootstrap gate | 0 (GREEN) | 3/3 tests | .gate-logs/gate.log (overwritten per run) |

Pins: `assertPlayerCount` accepts 2–6, refuses out-of-range and non-integer loudly.
