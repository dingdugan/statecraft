import { describe, it, expect } from 'vitest';
import { newGame, advanceTurn } from './index';
import { FOCUSES } from '../data/focuses';
import { resolveEventChoice } from './reducers/events';

describe('focus (a) six mutually-exclusive focuses, each does something', () => {
  it('every focus moves the state (no no-ops)', () => {
    expect(FOCUSES.length).toBe(6);
    for (const f of FOCUSES) {
      const base = advanceTurn(newGame('DE', 5), {});
      const withF = advanceTurn(newGame('DE', 5), { focus: f.id });
      const moved =
        withF.gdp !== base.gdp ||
        withF.reserves !== base.reserves ||
        withF.approval !== base.approval ||
        withF.techLevel !== base.techLevel ||
        withF.healthIndex !== base.healthIndex;
      expect(moved, f.id).toBe(true);
    }
  });
});

describe('focus (b) 拼经济 is a real tradeoff', () => {
  it('lifts GDP + lowers unemployment, but worsens inequality vs no focus (same seed)', () => {
    const base = advanceTurn(newGame('DE', 9), {});
    const eco = advanceTurn(newGame('DE', 9), { focus: 'economy' });
    expect(eco.gdp).toBeGreaterThan(base.gdp);
    expect(eco.unemployment).toBeLessThan(base.unemployment);
    expect(eco.inequality).toBeGreaterThan(base.inequality);
  });
});

describe('crisis (a) opens, counts down, and busts on timeout', () => {
  it('a sustained debt crisis eventually fails into bankruptcy', () => {
    let s = newGame('JP', 3);
    s.debtPctGdp = 1.5; // force into the danger band
    s = advanceTurn(s, {});
    if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
    expect(s.activeCrisis?.id).toBe('debt');
    for (let i = 0; i < 8 && s.status === 'playing'; i++) {
      if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
      s.debtPctGdp = 1.5; // never reverse it
      s = advanceTurn(s, {});
    }
    if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
    expect(s.status).toBe('bankrupt');
  });
});

describe('crisis (b) reversing it clears the crisis', () => {
  it('pulling debt back to safety clears the crisis with no bust', () => {
    let s = newGame('JP', 3);
    s.debtPctGdp = 1.5;
    s = advanceTurn(s, {});
    if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
    expect(s.activeCrisis?.id).toBe('debt');
    s.debtPctGdp = 0.9; // back under the clear line (1.15)
    s = advanceTurn(s, {});
    if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
    expect(s.activeCrisis).toBeNull();
    expect(s.status).toBe('playing');
  });
});
