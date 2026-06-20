import { describe, it, expect } from 'vitest';
import { newGame } from './index';
import { EVENTS, WORLD_EVENTS, getEvent } from '../data/events';
import { resolveEventChoice, maybeFireEvent } from './reducers/events';
import { Rng } from './rng';
import type { StepContext } from './context';

describe('events (a) library integrity', () => {
  it('unique ids, ≥1 option each, chain targets exist, sizable library', () => {
    const ids = new Set<string>();
    for (const e of EVENTS) {
      expect(e.options.length, e.id).toBeGreaterThan(0);
      expect(ids.has(e.id), `dup ${e.id}`).toBe(false);
      ids.add(e.id);
    }
    for (const id of ['bailout_aftermath', 'investigation_result']) expect(getEvent(id), id).toBeTruthy();
    expect(EVENTS.length).toBeGreaterThanOrEqual(30);
    expect(WORLD_EVENTS.length).toBeGreaterThan(0);
  });
});

describe('events (b) every option applies cleanly', () => {
  it('resolving any option keeps core fields finite + 0..100 bounded', () => {
    for (const e of EVENTS) {
      for (let i = 0; i < e.options.length; i++) {
        let s = newGame('DE', 42);
        s.pendingEventId = e.id;
        s = resolveEventChoice(s, e.id, i);
        for (const f of ['gdp', 'approval', 'reserves', 'debtPctGdp', 'unrest', 'inflation'] as const) {
          expect(Number.isFinite(s[f] as number), `${e.id}#${i}.${f}`).toBe(true);
        }
        for (const k of ['approval', 'unrest', 'stability', 'legitimacy', 'healthIndex'] as const) {
          expect(s[k], `${e.id}#${i}.${k}`).toBeGreaterThanOrEqual(0);
          expect(s[k], `${e.id}#${i}.${k}`).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('events (c) multi-turn chain fires', () => {
  it('banking_crisis bailout schedules + later fires bailout_aftermath', () => {
    let s = newGame('DE', 7);
    s.pendingEventId = 'banking_crisis';
    s = resolveEventChoice(s, 'banking_crisis', 0); // bail out → schedules bailout_aftermath
    expect(s.chainQueue.some((c) => c.eventId === 'bailout_aftermath')).toBe(true);
    const ctx: StepContext = { rng: new Rng(s.rng), year: s.year, decisions: {}, log: [] };
    s = maybeFireEvent(s, ctx); // ticks queue (1→0) and makes the chained event pending
    expect(s.pendingEventId).toBe('bailout_aftermath');
    expect(s.chainQueue.some((c) => c.eventId === 'bailout_aftermath')).toBe(false);
  });
});
