import { describe, it, expect } from 'vitest';
import { generateFigures } from '../data/characters';
import { newGame, newWorld, advanceTurn } from './index';
import { resolveEventChoice } from './reducers/events';

describe('characters (a) deterministic generation', () => {
  it('same country+seed ⇒ identical cast; 4-6 figures, valid fields, has opposition + military', () => {
    const a = generateFigures('DE', 123);
    const b = generateFigures('DE', 123);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(a.length).toBeLessThanOrEqual(6);
    for (const f of a) {
      expect(f.nameZh.length).toBeGreaterThan(0);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.loyalty).toBeGreaterThanOrEqual(-100);
      expect(f.loyalty).toBeLessThanOrEqual(100);
    }
    expect(a.some((f) => f.title === '反对党领袖')).toBe(true);
    expect(a.some((f) => f.title === '军方统帅')).toBe(true);
  });
});

describe('characters (b) newGame populates the cast', () => {
  it('a fresh country has a cast; different countries get different casts', () => {
    const w = newWorld('JP', 7);
    expect(w.countries.JP.figures.length).toBeGreaterThanOrEqual(4);
    expect(w.countries.JP.figures).not.toEqual(w.countries.DE.figures);
  });
});

describe('characters (c) events shift a figure’s loyalty', () => {
  const milLoyDelta = (opt: number): number => {
    let s = newGame('DE', 5);
    const before = s.figures.find((f) => f.title === '军方统帅')!.loyalty;
    s.pendingEventId = 'coup_rumor';
    s = resolveEventChoice(s, 'coup_rumor', opt);
    return s.figures.find((f) => f.title === '军方统帅')!.loyalty - before;
  };
  it('purging officers lowers the military chief; buying loyalty raises them', () => {
    expect(milLoyDelta(0)).toBeLessThan(0); // 清洗 → 记恨
    expect(milLoyDelta(1)).toBeGreaterThan(0); // 收买 → 领情
  });
});

describe('characters (d) collapsed loyalty stages a one-time drama', () => {
  it('a hostile military chief attempts a coup (coupRisk spikes), marked acted, no repeat', () => {
    let s = newGame('DE', 5);
    s.figures.find((f) => f.title === '军方统帅')!.loyalty = -80;
    s = advanceTurn(s, {});
    if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
    const mil = s.figures.find((f) => f.title === '军方统帅')!;
    expect(mil.acted).toBe(true);
    expect(s.coupRisk).toBeGreaterThan(20);
    // already acted → keeps the flag, no re-trigger crash
    s = advanceTurn(s, {});
    expect(s.figures.find((f) => f.title === '军方统帅')!.acted).toBe(true);
  });
});

describe('characters (e) drama is recorded in the chronicle', () => {
  it('a coup attempt leaves a fig: chronicle entry', () => {
    let s = newGame('DE', 5);
    s.figures.find((f) => f.title === '军方统帅')!.loyalty = -80;
    s = advanceTurn(s, {});
    if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
    expect(s.chronicle.some((c) => c.id.startsWith('fig:'))).toBe(true);
  });
});
