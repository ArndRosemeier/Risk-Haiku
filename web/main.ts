// The Risk hero UI. It renders the engine's state and routes every player action
// through the engine. It contains NO rules: an illegal click is refused by the
// engine, and that loud error is shown to the player (house rule 1).

import { TERRITORIES, TERRITORY_BY_ID, CONTINENTS, validateMap } from "../src/map.js";
import {
  newGame, placeReinforcement, endReinforce, attack, endAttack, fortify, endTurn,
  tradeCards, territoriesOf, reinforcementsFor, type Game, type Phase,
} from "../src/game.js";
import { createRng } from "../src/rng.js";
import { planTurn } from "../src/ai.js";
import { serialize, deserialize } from "../src/save.js";

const SAVE_KEY = "risk-hero-save-v1";
const AI_DELAY_MS = 420;
// One attack step is a single dice round, and a turn can now hold a long run of them,
// so the per-round beat is much shorter than the per-turn beat.
const AI_ATTACK_DELAY_MS = 90;

// --- state ---------------------------------------------------------------
type Mode = { kind: "hotseat" } | { kind: "vsAi"; humanId: number };

let game: Game;
let mode: Mode = { kind: "vsAi", humanId: 0 };
let selected: string | null = null;
let busy = false; // AI is thinking; human input is locked
let battleRng = createRng(Date.now() & 0x7fffffff);

// --- DOM -----------------------------------------------------------------
const $ = <T extends Element>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`UI element #${id} is missing from index.html`);
  return el as unknown as T;
};
const svg = $<SVGSVGElement>("map");
const els = {
  turnline: $("turnline"), phase: $("phase"), hint: $("hint"), actions: $("actions"),
  players: $("players"), battle: $("battle"), log: $("log"), banner: $<HTMLElement>("banner"),
};

// --- map rendering -------------------------------------------------------
// Territory "shapes" are soft polygons generated from each territory's anchor point
// on the 0..100 x 0..92 canvas. They are a presentation layer: adjacency and rules
// come only from the engine's map data.
const SVG_NS = "http://www.w3.org/2000/svg";
const shapeOf = (x: number, y: number): string => {
  const r = 3.6;
  const pts: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (x * 0.37 + y * 0.11);
    const rr = r * (0.82 + 0.18 * Math.sin(i * 2.3 + x + y));
    pts.push(`${(x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr * 0.9).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
};

function buildMap(): void {
  svg.innerHTML = "";
  // Draw connections first, so the lines sit underneath the territories.
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "links");
  const drawn = new Set<string>();
  for (const t of TERRITORIES) {
    for (const n of t.neighbors) {
      const key = [t.id, n].sort().join("|");
      if (drawn.has(key)) continue;
      drawn.add(key);
      const o = TERRITORY_BY_ID.get(n)!;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(t.x)); line.setAttribute("y1", String(t.y));
      line.setAttribute("x2", String(o.x)); line.setAttribute("y2", String(o.y));
      line.setAttribute("stroke", "rgba(120,140,200,.22)");
      line.setAttribute("stroke-width", "0.3");
      g.appendChild(line);
    }
  }
  svg.appendChild(g);
  for (const t of TERRITORIES) {
    const grp = document.createElementNS(SVG_NS, "g");
    grp.setAttribute("class", "territory");
    grp.setAttribute("data-id", t.id);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "shape");
    path.setAttribute("d", shapeOf(t.x, t.y));
    grp.appendChild(path);
    const name = document.createElementNS(SVG_NS, "text");
    name.setAttribute("class", "tname");
    name.setAttribute("x", String(t.x)); name.setAttribute("y", String(t.y - 3.2));
    // Stagger labels for territories whose names would otherwise collide.
    if (t.id === "western-europe") name.setAttribute("x", String(t.x - 3.5));
    if (t.id === "northern-europe") name.setAttribute("x", String(t.x + 3));
    if (t.id === "western-australia") name.setAttribute("x", String(t.x - 4));
    if (t.id === "eastern-australia") name.setAttribute("x", String(t.x - 2));
    name.textContent = t.name;
    grp.appendChild(name);
    const count = document.createElementNS(SVG_NS, "text");
    count.setAttribute("class", "count");
    count.setAttribute("x", String(t.x)); count.setAttribute("y", String(t.y + 1.2));
    grp.appendChild(count);
    grp.addEventListener("click", () => onTerritoryClick(t.id));
    svg.appendChild(grp);
  }
}

function paintMap(): void {
  for (const t of TERRITORIES) {
    const grp = svg.querySelector<SVGGElement>(`g.territory[data-id="${t.id}"]`);
    if (!grp) throw new Error(`map is missing territory ${t.id}`);
    const owner = game.owner[t.id]!;
    const p = game.players[owner]!;
    grp.querySelector<SVGPathElement>(".shape")!.setAttribute("fill", p.color);
    grp.querySelector<SVGTextElement>(".count")!.textContent = String(game.armies[t.id]);
    grp.classList.toggle("selected", selected === t.id);
    grp.classList.toggle("target", isAttackTarget(t.id));
    grp.classList.toggle("legal", isLegalSource(t.id) || isLegalFortifyTarget(t.id));
  }
}

// Which territories may be clicked, given the phase and the current selection.
function isLegalSource(tid: string): boolean {
  if (game.phase !== "attack") return false;
  return game.owner[tid] === game.currentPlayer && game.armies[tid]! > 1 &&
    TERRITORY_BY_ID.get(tid)!.neighbors.some((n) => game.owner[n] !== game.currentPlayer);
}
function isAttackTarget(tid: string): boolean {
  if (game.phase !== "attack" || !selected) return false;
  return game.owner[tid] !== game.currentPlayer && TERRITORY_BY_ID.get(selected)!.neighbors.includes(tid);
}
function isLegalFortifyTarget(tid: string): boolean {
  return game.phase === "fortify" && selected !== null && selected !== tid &&
    game.owner[tid] === game.currentPlayer && game.owner[selected] === game.currentPlayer;
}

// --- input ---------------------------------------------------------------
function isHumanTurn(): boolean {
  if (mode.kind === "hotseat") return true;
  return game.currentPlayer === mode.humanId;
}

function onTerritoryClick(tid: string): void {
  if (busy || game.phase === "over" || !isHumanTurn()) return;
  try {
    handleClick(tid);
  } catch (e) {
    showError((e as Error).message);
  }
  render();
}

function handleClick(tid: string): void {
  if (game.phase === "reinforce") {
    // Click your own territory to place the next reinforcement (1 at a time).
    if (game.owner[tid] !== game.currentPlayer) throw new Error(`${TERRITORY_BY_ID.get(tid)!.name} is not yours to reinforce`);
    game = placeReinforcement(game, tid, 1);
    selected = tid;
    return;
  }
  if (game.phase === "attack") {
    if (selected && isAttackTarget(tid)) {
      const out = attack(battleRng, game, selected, tid, Math.max(1, game.armies[selected]! - 1));
      game = out.game;
      showBattle(out.combat, out.conquered);
      if (out.conquered) flash(tid);
      selected = game.armies[selected]! > 1 ? selected : null;
      return;
    }
    if (game.owner[tid] === game.currentPlayer) {
      selected = tid;
      return;
    }
    throw new Error(`pick one of your territories, then an adjacent enemy`);
  }
  if (game.phase === "fortify") {
    if (!selected) {
      if (game.owner[tid] !== game.currentPlayer) throw new Error(`pick one of your territories to move armies from`);
      selected = tid;
      return;
    }
    if (tid === selected) { selected = null; return; }
    // Move the spare armies (keeping 1) from the selected to the clicked territory.
    const count = game.armies[selected]! - 1;
    if (count < 1) throw new Error(`${TERRITORY_BY_ID.get(selected)!.name} has no spare armies to move`);
    game = fortify(game, selected, tid, count);
    selected = null;
    game = endTurn(game);
    return;
  }
}

function flash(tid: string): void {
  const grp = svg.querySelector<SVGGElement>(`g.territory[data-id="${tid}"]`);
  if (!grp) return;
  grp.classList.remove("flash");
  void grp.getBoundingClientRect();
  grp.classList.add("flash");
}

// --- rendering -----------------------------------------------------------
function render(): void {
  paintMap();
  const cur = game.players[game.currentPlayer]!;
  els.turnline.textContent = game.phase === "over"
    ? `Game over — ${game.players[game.winner ?? 0]!.name} wins`
    : `Turn ${game.turn} · ${cur.name}${isHumanTurn() ? " (you)" : " (AI)"}`;
  els.phase.textContent = phaseLabel(game.phase);
  els.hint.textContent = hintFor();
  renderActions();
  renderPlayers();
  renderLog();
}

function phaseLabel(p: Phase): string {
  return ({ reinforce: "1 · Reinforce", attack: "2 · Attack", fortify: "3 · Fortify", over: "Game over" } as const)[p];
}

function hintFor(): string {
  if (busy) return "The AI is thinking…";
  if (game.phase === "over") return "The world is yours — start a new game to play again.";
  if (!isHumanTurn()) return "Watching the AI…";
  switch (game.phase) {
    case "reinforce":
      return `Click your territories to place ${game.pendingReinforcements} reinforcement(s).`;
    case "attack":
      return selected
        ? "Click an adjacent enemy to attack, or pick another territory."
        : "Select one of your territories with 2+ armies, then an adjacent enemy.";
    case "fortify":
      return selected
        ? "Click a connected territory of yours to move spare armies there."
        : "Optionally move armies from one territory to another, or skip.";
  }
  return "";
}

function renderActions(): void {
  const a = els.actions;
  a.innerHTML = "";
  if (busy || !isHumanTurn() || game.phase === "over") return;

  if (game.phase === "reinforce") {
    const left = document.createElement("div");
    left.innerHTML = `<strong>${game.pendingReinforcements}</strong> armies to place this turn.`;
    a.appendChild(left);
    const done = button("Confirm reinforcements", "primary", () => {
      try { game = endReinforce(game); selected = null; } catch (e) { showError((e as Error).message); }
      render();
    });
    done.disabled = game.pendingReinforcements > 0;
    a.appendChild(done);
    const cards = game.players[game.currentPlayer]!.cards;
    if (cards.length >= 3) {
      a.appendChild(button(`Trade 3 cards (${cards.length} held)`, "", () => {
        try { game = tradeCards(game, [0, 1, 2]); } catch (e) { showError((e as Error).message); }
        render();
      }));
    }
  } else if (game.phase === "attack") {
    a.appendChild(button("End attacks", "primary", () => {
      game = endAttack(game); selected = null; render();
    }));
  } else if (game.phase === "fortify") {
    a.appendChild(button("Skip fortify & end turn", "primary", () => {
      game = endTurn(game); selected = null; render();
    }));
  }
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

function renderPlayers(): void {
  els.players.innerHTML = "";
  for (const p of game.players) {
    const li = document.createElement("li");
    const cls = [p.alive ? "" : "out", p.id === game.currentPlayer ? "you" : ""].filter(Boolean).join(" ");
    li.className = cls;
    const terrs = territoriesOf(game, p.id);
    const armies = terrs.reduce((s, t) => s + game.armies[t]!, 0);
    const bonus = p.alive ? reinforcementsFor(game, p.id) : 0;
    li.innerHTML = `<span class="swatch" style="background:${p.color}"></span>
      <span>${escape(p.name)}${p.id === game.currentPlayer ? " ◀" : ""}</span>
      <span class="stats">${terrs.length} terr · ${armies} arm · +${bonus}/turn</span>`;
    els.players.appendChild(li);
  }
}

function renderLog(): void {
  els.log.innerHTML = "";
  for (const line of game.log.slice(-40).reverse()) {
    const li = document.createElement("li");
    li.textContent = line;
    els.log.appendChild(li);
  }
}

function showBattle(c: { attackerRolls: readonly number[]; defenderRolls: readonly number[]; attackerLosses: number; defenderLosses: number }, conquered: boolean): void {
  const dice = (rolls: readonly number[]) =>
    rolls.map((r) => `<span class="die">${r}</span>`).join("");
  els.battle.innerHTML = `
    <div class="dice"><span>ATK</span>${dice(c.attackerRolls)}</div>
    <div class="dice"><span>DEF</span>${dice(c.defenderRolls)}</div>
    <div>Losses — attacker ${c.attackerLosses}, defender ${c.defenderLosses}${conquered ? " · <strong>conquered!</strong>" : ""}</div>`;
  const banner = conquered ? "TERRITORY CONQUERED" : `⚔ −${c.attackerLosses} / −${c.defenderLosses}`;
  showBanner(banner);
}

function showBanner(text: string): void {
  els.banner.textContent = text;
  els.banner.hidden = false;
  clearTimeout((showBanner as unknown as { t?: number }).t);
  (showBanner as unknown as { t?: number }).t = window.setTimeout(() => { els.banner.hidden = true; }, 1400);
}

function showError(msg: string): void {
  els.hint.innerHTML = `<span class="error">${escape(msg)}</span>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]!);
}

// --- AI driver -----------------------------------------------------------
// The AI's plan is applied through the engine one step at a time with a visible
// delay, so the player can follow the turn. Any move the engine refuses stops the
// AI loudly, rather than being skipped.
async function runAiTurns(): Promise<void> {
  if (mode.kind !== "vsAi") return;
  busy = true;
  render();
  try {
    while (game.phase !== "over" && game.currentPlayer !== mode.humanId) {
      await sleep(AI_DELAY_MS);
      const plan = planTurn(game);
      for (const r of plan.reinforce) {
        for (let i = 0; i < r.count; i++) game = placeReinforcement(game, r.territory, 1);
      }
      game = endReinforce(game);
      render();
      for (const a of plan.attacks) {
        // The plan is a forecast over many dice rounds: an earlier round may have taken
        // the target or emptied the source. Re-check before applying, then let the
        // engine stay the final authority on legality.
        if (
          game.owner[a.from] !== game.currentPlayer ||
          game.owner[a.to] === game.currentPlayer ||
          game.armies[a.from]! < 2
        ) {
          continue;
        }
        await sleep(AI_ATTACK_DELAY_MS);
        const moveIn = Math.max(1, Math.min(game.armies[a.from]! - 1, a.advance));
        const out = attack(battleRng, game, a.from, a.to, moveIn);
        game = out.game;
        showBattle(out.combat, out.conquered);
        if (out.conquered) flash(a.to);
        render();
        if (game.phase === "over") break;
      }
      if (game.phase === "over") break;
      game = endAttack(game);
      if (plan.fortify) {
        await sleep(AI_DELAY_MS);
        game = fortify(game, plan.fortify.from, plan.fortify.to, plan.fortify.count);
      }
      game = endTurn(game);
      render();
    }
  } catch (e) {
    showError(`AI stopped: ${(e as Error).message}`);
  } finally {
    busy = false;
    render();
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- commands ------------------------------------------------------------
function startGame(): void {
  const seed = Math.floor(Math.random() * 2 ** 31);
  battleRng = createRng(seed ^ 0x9e3779b9);
  mode = { kind: "vsAi", humanId: 0 };
  game = newGame({ seed, names: ["You", "Rival", "Warlord"] });
  selected = null;
  els.battle.textContent = "No battle yet.";
  render();
}

function saveGame(): void {
  localStorage.setItem(SAVE_KEY, serialize(game));
  showBanner("GAME SAVED");
}

function loadGame(): void {
  const text = localStorage.getItem(SAVE_KEY);
  if (text === null) { showError("No saved game to load."); return; }
  try {
    game = deserialize(text);
    selected = null;
    render();
    showBanner("GAME LOADED");
  } catch (e) {
    showError(`Could not load save: ${(e as Error).message}`);
  }
}

// --- boot ----------------------------------------------------------------
validateMap();
buildMap();
$<HTMLButtonElement>("btn-new").addEventListener("click", () => { startGame(); void maybeRunAi(); });
$<HTMLButtonElement>("btn-save").addEventListener("click", saveGame);
$<HTMLButtonElement>("btn-load").addEventListener("click", () => { loadGame(); void maybeRunAi(); });

async function maybeRunAi(): Promise<void> {
  if (!busy && mode.kind === "vsAi" && game.currentPlayer !== mode.humanId && game.phase !== "over") {
    await runAiTurns();
  }
}

startGame();
void maybeRunAi();
void CONTINENTS; // continent data is consumed by the engine; the UI shows bonuses via reinforcementsFor
