import { describe, it, expect } from 'vitest';
import { newWorld, advanceWorld, COUNTRY_IDS } from './index';
import type { GameState, PendingDecisions, Allocation } from './index';
import { resolveEventChoice } from './reducers/events';
import { serializeWorld, deserializeWorld, worldFingerprint } from './save';
import { Rng, makeRngState } from './rng';
import { normalizeAllocation, SPEND_CATEGORIES } from './util';

type World = ReturnType<typeof newWorld>;

/** Advance the world a year; auto-resolve the player's fired event (option `opt`). */
function playW(w: World, d: PendingDecisions = {}, opt = 0): World {
  const n = advanceWorld(w, d);
  const p = n.countries[n.playerId];
  if (p.pendingEventId) n.countries[n.playerId] = resolveEventChoice(p, p.pendingEventId, opt);
  return n;
}

function randomAllocation(rng: Rng): Allocation {
  return normalizeAllocation(
    SPEND_CATEGORIES.reduce((o, c) => ((o[c] = rng.next()), o), {} as Allocation),
  );
}
function randomDecisions(rng: Rng): PendingDecisions {
  return { taxRate: rng.range(0.1, 0.6), spendingPctGdp: rng.range(0.1, 0.7), allocation: randomAllocation(rng) };
}

const CHK: (keyof GameState)[] = [
  'gdp', 'gdpGrowthReal', 'score', 'approval', 'stability', 'unrest',
  'debtPctGdp', 'inflation', 'climateStress', 'warScore', 'priceLevel', 'reserves',
];

describe('world (a) determinism', () => {
  it('same seed + decisions ⇒ identical world over 20 turns', () => {
    const decRng = new Rng(makeRngState(999));
    const decisions = Array.from({ length: 20 }, () => randomDecisions(decRng));
    const run = () => {
      let w = newWorld('DE', 12345);
      for (const d of decisions) w = playW(w, d);
      return w;
    };
    expect(worldFingerprint(run())).toBe(worldFingerprint(run()));
  });
});

describe('world (b) save → reload identity', () => {
  it('reloaded world continues identically', () => {
    let live = newWorld('CN', 77);
    for (let i = 0; i < 10; i++) live = playW(live);
    const reloaded = deserializeWorld(serializeWorld(live))!;
    expect(reloaded).not.toBeNull();
    expect(worldFingerprint(reloaded)).toBe(worldFingerprint(live));
    let r2 = deserializeWorld(serializeWorld(reloaded))!;
    for (let i = 0; i < 8; i++) { live = playW(live); r2 = playW(r2); }
    expect(worldFingerprint(r2)).toBe(worldFingerprint(live));
  });
});

describe('world (c) all 16 countries advance', () => {
  it('every playing country advances a turn', () => {
    let w = newWorld('DE', 1);
    expect(Object.keys(w.countries).length).toBe(16);
    w = playW(w);
    expect(w.turn).toBe(1);
    for (const id of COUNTRY_IDS) expect(w.countries[id].turn).toBe(1);
  });
});

describe('world (d) player fail reachable', () => {
  it('a volatile player country can be voted out', () => {
    let w = newWorld('NG', 5);
    for (let i = 0; i < 12 && w.countries[w.playerId].status === 'playing'; i++) w = playW(w);
    expect(w.countries.NG.status).toBe('voted_out');
  });
});

describe('world (e) player victory reachable', () => {
  it('a wealthy player past the tenure floor wins', () => {
    let w = newWorld('DE', 7);
    w.countries.DE.turn = 25;
    w.countries.DE.gdp = 15000;
    w = playW(w);
    expect(w.countries.DE.status).toBe('victory');
  });
});

describe('world (f) 16-country fuzz holds', () => {
  it('no NaN, bounded fields stay in range across 30 turns', () => {
    const decRng = new Rng(makeRngState(424242));
    let w = newWorld('CN', 31337);
    for (let i = 0; i < 30 && w.countries[w.playerId].status === 'playing'; i++) {
      w = playW(w, randomDecisions(decRng), i % 2);
      for (const id of COUNTRY_IDS) {
        const c = w.countries[id];
        for (const f of CHK) expect(Number.isFinite(c[f] as number), `${id}.${String(f)}`).toBe(true);
        for (const k of ['approval', 'stability', 'unrest'] as const) {
          expect(c[k]).toBeGreaterThanOrEqual(0);
          expect(c[k]).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('world (g) dynamic but not degenerate', () => {
  it('relations move and the world does not mass-collapse over 40 turns', () => {
    let w = newWorld('DE', 8888);
    const before = { ...w.countries.DE.relations };
    for (let i = 0; i < 40 && w.countries.DE.status === 'playing'; i++) w = playW(w);
    // (1) world diplomacy is live: at least one relation has drifted
    const moved = COUNTRY_IDS.some(
      (id) => id !== w.playerId && Math.abs((w.countries.DE.relations[id] ?? 0) - ((before[id] as number) ?? 0)) > 1,
    );
    expect(moved).toBe(true);
    // (2) no mass hard-collapse: catastrophic ends stay rare (balance sim: 0 across 12 worlds).
    // voted_out / victory are normal NPC outcomes, not collapse, so we count only hard failures.
    const HARD = ['bankrupt', 'revolution', 'coup', 'defeated'];
    const collapsed = COUNTRY_IDS.filter((id) => HARD.includes(w.countries[id].status)).length;
    expect(collapsed).toBeLessThanOrEqual(4);
  });
});

describe('world (h) international wars can ignite', () => {
  it('across several worlds, NPC relations sour into at least one declared war', () => {
    let wars = 0;
    for (const seed of [1007, 2007, 3007, 4007, 5007, 6007]) {
      let w = newWorld('DE', seed);
      for (let i = 0; i < 40 && w.countries.DE.status === 'playing'; i++) {
        w = playW(w);
        wars += w.news.filter((n) => n.kind === 'war' && n.msg.includes('开战')).length;
      }
    }
    expect(wars).toBeGreaterThan(0);
  });
});
