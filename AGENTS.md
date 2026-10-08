# Risk — agent/workspace rules

A Risk-style strategy board game in TypeScript (Node 24, `tsc`, `vitest`).

The full process is in the Toolbox repo (`~/projects/Toolbox/docs/WAY-OF-WORKING.md`).
This file holds only what is binding here.

## Binding engineering rules

1. **No silent fallbacks.** A failed step throws a loud error. No catch-and-continue,
   no placeholder values standing in for required data.
2. **Validate at every boundary** (player counts, map data, moves from input).
3. **Centralize.** One idea, one seam. Route callers through it.
4. **Every brief and landing report carries** `COPIES: n→1 — <seam>` or
   `COPIES: 1 — checked (grepped: <what>)`.

## Standing rule: the owner's instructions are INTENT, not design

Critique a flawed ask once, with evidence. Do not silently substitute a design.

## Parallel writers

At most TWO writers in flight, each in its own worktree under `worktrees/<slice>`
with ABSOLUTE paths. Rebase before every push. A writer that cannot finish commits its
partial state and reports BLOCKED.

## The gate

`bash scripts/gate.sh` is the only gate. Exit codes: `0` green · `1` red ·
`2` cheap tier only · `9` refused (lock held; VOID). `GATE_TESTS=0` runs the cheap tier
only. Never pipe a check through `tail`/`head`. Read the raw log in `.gate-logs/`.

## Host hygiene

No synthetic load. One suite at a time (the lock). Kill processes by PID captured in
a separate call, never by pattern from the same shell.
