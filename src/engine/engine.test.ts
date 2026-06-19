import { describe, it, expect } from 'vitest';
import { newGame, advanceTurn } from './index';
import { resolveEventChoice } from './reducers/events';
import { serialize, deserialize, fingerprint } from './save';
import { normalizeAllocation } from './util';
import { Rng } from './rng';
import { makeRngState } from './rng';
import type { GameState, PendingDecisions, Allocation } from './types';

/** Advance one year, auto-resolving any fired event with the given option (default 0). */
function play(s: GameState, decisions: PendingDecisions = {}, opt = 0): GameState {
  let next = advanceTurn(s, decisions);
  if (next.pendingEventId) next = resolveEventChoice(next, next.pendingEventId, opt);
  return next;
}

function randomAllocation(rng: Rng): Allocation {
  return normalizeAllocation({
    military: rng.next(),
    education: rng.next(),
    healthcare: rng.next(),
    infrastructure: rng.next(),
    welfare: rng.next(),
    rnd: rng.next(),
  });
}

function randomDecisions(rng: Rng): PendingDecisions {
  return {
    taxRate: rng.range(0.1, 0.6),
    spendingPctGdp: rng.range(0.1, 0.7),
    allocation: randomAllocation(rng),
  };
}

const NUMERIC_FIELDS: (keyof GameState)[] = [
  'gdp', 'gdpGrowthReal', 'productivity', 'unemployment', 'inflation', 'population',
  'popGrowth', 'medianAge', 'approval', 'stability', 'unrest', 'taxRate',
  'spendingPctGdp', 'debtPctGdp', 'creditRating', 'deficitPctGdp', 'reserves',
  'prosperity', 'score', 'inequality', 'healthIndex', 'qualityOfLife', 'legitimacy',
  'techLevel', 'militaryStrength', 'militaryReadiness', 'coupRisk',
  'globalStanding', 'tradeBalance', 'sanctionPressure', 'warScore', 'warExhaustion',
  'commodityPrice', 'resourceDepletion', 'resourceIncome', 'emissions', 'climateStress',
  'priceLevel',
];

describe('(a) determinism', () => {
  it('same seed + same decisions ⇒ identical state over 20 turns', () => {
    const decRng = new Rng(makeRngState(999));
    const decisions = Array.from({ length: 20 }, () => randomDecisions(decRng));

    const runA = () => {
      let s = newGame('DE', 12345);
      for (const d of decisions) s = play(s, d, 0);
      return s;
    };
    expect(fingerprint(runA())).toBe(fingerprint(runA()));
  });
});

describe('(b) save → reload identity', () => {
  it('reloaded game continues identically', () => {
    let live = newGame('CN', 77);
    for (let i = 0; i < 10; i++) live = play(live);
    const reloaded = deserialize(serialize(live))!;
    expect(reloaded).not.toBeNull();
    expect(fingerprint(reloaded)).toBe(fingerprint(live));

    for (let i = 0; i < 10; i++) {
      live = play(live);
      // mirror the same auto-resolve on the reloaded copy
    }
    let reload2 = deserialize(serialize(reloaded))!;
    for (let i = 0; i < 10; i++) reload2 = play(reload2);
    expect(fingerprint(reload2)).toBe(fingerprint(live));
  });
});

describe('(c) bankruptcy reachable', () => {
  it('max-spend / min-tax fiscal suicide drives a low-rated state to bankrupt', () => {
    let s = newGame('NG', 5);
    const bad: PendingDecisions = { taxRate: 0.1, spendingPctGdp: 0.7 };
    for (let i = 0; i < 30 && s.status === 'playing'; i++) s = play(s, bad);
    expect(s.status).toBe('bankrupt');
  });
});

describe('(d) revolution reachable', () => {
  it('starving services + max tax collapses an authoritarian state into revolution', () => {
    // authoritarian (no election valve) → bad governance ends in revolution, not vote-out
    let s = newGame('CN', 9);
    const starve: PendingDecisions = {
      taxRate: 0.6,
      spendingPctGdp: 0.1,
      allocation: normalizeAllocation({
        military: 1, education: 0, healthcare: 0, infrastructure: 0, welfare: 0, rnd: 0,
      }),
    };
    for (let i = 0; i < 60 && s.status === 'playing'; i++) s = play(s, starve);
    expect(s.status).toBe('revolution');
  });
});

describe('(e)+(f) clamps + normalization hold under 50-turn fuzz', () => {
  it('no NaN, every bounded field stays in range, allocation sums to 1', () => {
    const decRng = new Rng(makeRngState(424242));
    for (const country of ['DE', 'JP', 'NG', 'SG', 'SA', 'CN']) {
      let s = newGame(country, 31337);
      for (let i = 0; i < 50 && s.status === 'playing'; i++) {
        s = play(s, randomDecisions(decRng), i % 2);
        for (const f of NUMERIC_FIELDS) {
          expect(Number.isFinite(s[f] as number), `${country}.${String(f)} finite`).toBe(true);
        }
        expect(s.unemployment).toBeGreaterThanOrEqual(0.01);
        expect(s.unemployment).toBeLessThanOrEqual(0.45);
        expect(s.inflation).toBeGreaterThanOrEqual(-0.05);
        expect(s.inflation).toBeLessThanOrEqual(0.4);
        for (const k of ['approval', 'stability', 'unrest'] as const) {
          expect(s[k]).toBeGreaterThanOrEqual(0);
          expect(s[k]).toBeLessThanOrEqual(100);
        }
        expect(s.creditRating).toBeGreaterThanOrEqual(0);
        expect(s.creditRating).toBeLessThanOrEqual(20);
        expect(s.inequality).toBeGreaterThanOrEqual(0.2);
        expect(s.inequality).toBeLessThanOrEqual(0.7);
        expect(s.techLevel).toBeGreaterThanOrEqual(0.5);
        expect(s.techLevel).toBeLessThanOrEqual(3.0);
        for (const k of ['militaryStrength', 'militaryReadiness', 'coupRisk'] as const) {
          expect(s[k]).toBeGreaterThanOrEqual(0);
          expect(s[k]).toBeLessThanOrEqual(100);
        }
        expect(s.globalStanding).toBeGreaterThanOrEqual(0);
        expect(s.globalStanding).toBeLessThanOrEqual(100);
        expect(s.sanctionPressure).toBeGreaterThanOrEqual(0);
        expect(s.sanctionPressure).toBeLessThanOrEqual(100);
        for (const r of Object.values(s.relations)) {
          expect(Number.isFinite(r)).toBe(true);
          expect(r).toBeGreaterThanOrEqual(-100);
          expect(r).toBeLessThanOrEqual(100);
        }
        expect(s.warScore).toBeGreaterThanOrEqual(-100);
        expect(s.warScore).toBeLessThanOrEqual(100);
        expect(s.warExhaustion).toBeGreaterThanOrEqual(0);
        expect(s.warExhaustion).toBeLessThanOrEqual(100);
        expect(s.commodityPrice).toBeGreaterThanOrEqual(0.4);
        expect(s.commodityPrice).toBeLessThanOrEqual(2.2);
        expect(s.resourceIncome).toBeGreaterThanOrEqual(0);
        expect(s.resourceIncome).toBeLessThanOrEqual(0.3);
        for (const k of ['resourceDepletion', 'emissions', 'climateStress'] as const) {
          expect(s[k]).toBeGreaterThanOrEqual(0);
          expect(s[k]).toBeLessThanOrEqual(100);
        }
        for (const k of ['healthIndex', 'qualityOfLife', 'legitimacy'] as const) {
          expect(s[k]).toBeGreaterThanOrEqual(0);
          expect(s[k]).toBeLessThanOrEqual(100);
        }
        const allocSum = Object.values(s.allocation).reduce((a, b) => a + b, 0);
        expect(allocSum).toBeCloseTo(1, 6);
      }
    }
  });
});

describe('(g) prosperous play is not degenerate', () => {
  it('a healthy state stays governing with a strong score over 25 years', () => {
    let s = newGame('DE', 2025);
    for (let i = 0; i < 25 && s.status === 'playing'; i++) s = play(s); // keep defaults
    expect(['playing', 'victory']).toContain(s.status); // healthy: still governing or already won
    expect(s.score).toBeGreaterThan(45);
  });
});

describe('(h) war resolves', () => {
  it('a forced war with overwhelming strength concludes (warWith clears)', () => {
    let s = newGame('CN', 4);
    s.warWith = 'NG';
    s.militaryStrength = 95;
    s.militaryReadiness = 95;
    for (let i = 0; i < 15 && s.warWith !== null && s.status === 'playing'; i++) s = play(s);
    expect(s.warWith).toBeNull();
  });
});

describe('(i) victory reachable', () => {
  it('a wealthy, livable state past the tenure floor wins (prosperity)', () => {
    let s = newGame('DE', 7);
    s.turn = 25; // past the 20-year tenure floor
    s.gdp = 15000; // real GDP/cap well above the $100k prosperity bar for ~84M people
    s = play(s);
    expect(s.status).toBe('victory');
  });
});

describe('(j) save migration — a partial/old save loads and advances without crashing', () => {
  it('deserialize backfills missing fields; advanceTurn stays finite', () => {
    const full = newGame('DE', 1);
    // simulate a save written before later fields existed
    const partial = { ...full } as Record<string, unknown>;
    for (const k of [
      'traits', 'trendGrowth', 'lowStabilityStreak', 'deficitPctGdp', 'techLevel',
      'relations', 'commodityPrice', 'resourceDepletion', 'warWith', 'victoryStreak',
    ]) {
      delete partial[k];
    }
    const loaded = deserialize(JSON.stringify(partial));
    expect(loaded).not.toBeNull();
    let s = loaded!;
    for (let i = 0; i < 8; i++) s = play(s); // must not throw
    expect(Number.isFinite(s.gdp)).toBe(true);
    expect(Number.isFinite(s.score)).toBe(true);
  });
});
