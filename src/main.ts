import './style.css';
import { newWorld, advanceWorld, resolveEventChoice } from './engine';
import type { Allocation, GameState, PendingDecisions, WorldState } from './engine';
import { SPEND_CATEGORIES, normalizeAllocation } from './engine/util';
import { getCountry } from './data/countries';
import { GOV_LABELS } from './ui/format';
import { autoSave, loadAuto, saveSlot, loadSlot, clearSlot, slotInfo, SLOTS } from './ui/saveLoad';
import {
  menuHTML, dashboardHTML, decisionsHTML, eventModalHTML, reportHTML, endHTML, worldViewHTML, chronicleHTML,
} from './ui/view';

type Screen = 'menu' | 'play' | 'end';
interface App {
  screen: Screen;
  world: WorldState | null;
  pendingAlloc: Allocation;
  pendingTax: number;
  pendingSpend: number;
  pendingPolicies: string[];
  selectedScenario: string;
  view: 'home' | 'world';
  pendingActions: string[];
}

const esc = (x: string) => x.replace(/</g, '&lt;');

function evenAlloc(): Allocation {
  return SPEND_CATEGORIES.reduce((o, c) => ((o[c] = 1 / SPEND_CATEGORIES.length), o), {} as Allocation);
}

const app: App = {
  screen: 'menu',
  world: null,
  pendingAlloc: evenAlloc(),
  pendingTax: 0.3,
  pendingSpend: 0.3,
  pendingPolicies: [],
  selectedScenario: 'standard',
  view: 'home',
  pendingActions: [],
};

const root = document.getElementById('app')!;

/** The player's country (the one the dashboard renders). */
function player(): GameState | null {
  return app.world ? app.world.countries[app.world.playerId] : null;
}

function syncPendingFromGame(g: GameState): void {
  app.pendingAlloc = { ...g.allocation };
  app.pendingTax = g.taxRate;
  app.pendingSpend = g.spendingPctGdp;
  app.pendingPolicies = [];
  app.pendingActions = [];
}

// ─── transitions ───────────────────────────────────────────────────────────────
function startGame(id: string): void {
  let seed = Date.now() & 0x7fffffff;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0;
  seed &= 0x7fffffff;
  app.world = newWorld(id, seed, app.selectedScenario);
  app.screen = 'play';
  syncPendingFromGame(player()!);
  autoSave(app.world);
  render();
}

function continueGame(): void {
  const w = loadAuto();
  if (!w) return;
  app.world = w;
  const p = w.countries[w.playerId];
  app.screen = p.status === 'playing' ? 'play' : 'end';
  syncPendingFromGame(p);
  render();
}

function doAdvance(): void {
  const p = player();
  if (!app.world || !p || p.pendingEventId || p.status !== 'playing') return;
  const decisions: PendingDecisions = {
    taxRate: app.pendingTax,
    spendingPctGdp: app.pendingSpend,
    allocation: normalizeAllocation(app.pendingAlloc),
    enactPolicyIds: app.pendingPolicies,
    actions: app.pendingActions,
  };
  app.world = advanceWorld(app.world, decisions);
  autoSave(app.world);
  const np = player()!;
  if (np.status !== 'playing') app.screen = 'end';
  else syncPendingFromGame(np);
  render();
}

function doResolve(opt: number): void {
  const p = player();
  if (!app.world || !p?.pendingEventId) return;
  if (!Number.isInteger(opt) || opt < 0) return;
  app.world.countries[app.world.playerId] = resolveEventChoice(p, p.pendingEventId, opt);
  autoSave(app.world);
  if (player()!.status !== 'playing') app.screen = 'end';
  render();
}

function togglePolicy(id: string): void {
  const i = app.pendingPolicies.indexOf(id);
  if (i >= 0) app.pendingPolicies.splice(i, 1);
  else app.pendingPolicies.push(id);
  render();
}

function toggleAction(id: string): void {
  const i = app.pendingActions.indexOf(id);
  if (i >= 0) app.pendingActions.splice(i, 1);
  else app.pendingActions.push(id);
  render();
}

// ─── render ──────────────────────────────────────────────────────────────────────
function headerHTML(g: GameState): string {
  const c = getCountry(g.countryId);
  return `<header class="play-head">
    <div class="ph-id"><span class="flag">${c.flag}</span><span class="ph-name"><b>${c.nameZh}</b><small>${GOV_LABELS[g.govType]}</small></span></div>
    <div class="ph-year">${g.year}<small>年</small></div>
    <div class="ph-score"><small>治国评分</small><b>${g.score.toFixed(0)}</b></div>
    <button class="btn ghost" data-action="menu">≡ 菜单</button>
  </header>`;
}

function saveBarHTML(): string {
  const slots = SLOTS.map((n) => {
    const info = slotInfo(n);
    return `<div class="slot">
      <span class="slot-label">${info.label ? esc(info.label) : `存档位 ${n} · 空`}</span>
      <span class="slot-actions">
        <button class="btn xs" data-action="save" data-slot="${n}">存</button>
        ${info.label ? `<button class="btn xs" data-action="load" data-slot="${n}">读</button><button class="btn xs ghost" data-action="clearslot" data-slot="${n}">删</button>` : ''}
      </span></div>`;
  }).join('');
  return `<section class="savebar"><h3>存档</h3>${slots}</section>`;
}

function render(): void {
  if (app.screen === 'menu' || !app.world) {
    root.innerHTML = menuHTML(!!loadAuto(), app.selectedScenario);
    return;
  }
  const g = player()!;
  if (app.screen === 'end') {
    root.innerHTML = endHTML(g);
    return;
  }
  const tabs = `<div class="viewtabs">
    <button class="tab ${app.view === 'home' ? 'on' : ''}" data-action="view" data-view="home">本国</button>
    <button class="tab ${app.view === 'world' ? 'on' : ''}" data-action="view" data-view="world">世界</button>
  </div>`;
  const leftMain = app.view === 'world' ? worldViewHTML(app.world!) : `${dashboardHTML(g)}${reportHTML(g)}${chronicleHTML(g)}`;
  root.innerHTML = `<div class="play">
      ${headerHTML(g)}
      <div class="cols">
        <div class="left">${tabs}${leftMain}</div>
        <div class="right">${decisionsHTML(g, app.pendingTax, app.pendingSpend, app.pendingAlloc, app.pendingPolicies, app.pendingActions)}${saveBarHTML()}</div>
      </div>
    </div>
    ${eventModalHTML(g)}`;
  attachPlayListeners();
  updateAllocPct();
}

function updateAllocPct(): void {
  const norm = normalizeAllocation(app.pendingAlloc);
  for (const c of SPEND_CATEGORIES) {
    const el = document.getElementById(`allocpct-${c}`);
    if (el) el.textContent = `${Math.round(norm[c] * 100)}%`;
  }
}

function attachPlayListeners(): void {
  const tax = document.getElementById('tax') as HTMLInputElement | null;
  tax?.addEventListener('input', () => {
    app.pendingTax = Number(tax.value) / 100;
    const v = document.getElementById('taxval');
    if (v) v.textContent = `${tax.value}%`;
  });
  const spend = document.getElementById('spend') as HTMLInputElement | null;
  spend?.addEventListener('input', () => {
    app.pendingSpend = Number(spend.value) / 100;
    const v = document.getElementById('spendval');
    if (v) v.textContent = `${spend.value}%`;
  });
  for (const c of SPEND_CATEGORIES) {
    const el = document.getElementById(`alloc-${c}`) as HTMLInputElement | null;
    el?.addEventListener('input', () => {
      app.pendingAlloc[c] = Number(el.value) / 1000;
      updateAllocPct();
    });
  }
}

// ─── single delegated click handler ───────────────────────────────────────────────
root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
  if (!t) return;
  const action = t.dataset.action;
  // on the play screen, while an event modal is open, only resolving it (or menu) is allowed
  if (app.screen === 'play' && player()?.pendingEventId && action !== 'resolve' && action !== 'menu' && action !== 'view') return;
  const slot = Number(t.dataset.slot);
  switch (action) {
    case 'pick': startGame(t.dataset.id!); break;
    case 'scenario': app.selectedScenario = t.dataset.id!; render(); break;
    case 'view': app.view = t.dataset.view === 'world' ? 'world' : 'home'; render(); break;
    case 'continue': continueGame(); break;
    case 'advance': doAdvance(); break;
    case 'resolve': doResolve(Number(t.dataset.opt)); break;
    case 'policy': togglePolicy(t.dataset.id!); break;
    case 'action': toggleAction(t.dataset.id!); break;
    case 'menu': app.screen = 'menu'; render(); break;
    case 'save': if (app.world) { saveSlot(slot, app.world); render(); } break;
    case 'load': {
      const w = loadSlot(slot);
      if (w) {
        app.world = w;
        const p = w.countries[w.playerId];
        app.screen = p.status === 'playing' ? 'play' : 'end';
        syncPendingFromGame(p);
        render();
      }
      break;
    }
    case 'clearslot': clearSlot(slot); render(); break;
  }
});

render();
