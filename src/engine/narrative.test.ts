import { describe, it, expect } from 'vitest';
import { newGame, advanceTurn } from './index';
import { resolveEventChoice } from './reducers/events';

describe('narrative (a) year-mood line', () => {
  it('every advanced turn appends a 📜 narrative line to the log', () => {
    let s = newGame('DE', 5);
    s = advanceTurn(s);
    expect(s.log.some((l) => l.msg.includes('📜'))).toBe(true);
  });
});

describe('narrative (b) milestones recorded once', () => {
  it('a sustained milestone (score70) is recorded at most once', () => {
    let s = newGame('DE', 5);
    for (let i = 0; i < 4; i++) {
      if (s.pendingEventId) s = resolveEventChoice(s, s.pendingEventId, 0);
      s = advanceTurn(s);
    }
    const m = s.chronicle.filter((c) => c.id === 'score70');
    expect(m.length).toBeLessThanOrEqual(1);
  });
});

describe('narrative (c) war milestone enters the chronicle', () => {
  it('being dragged into war records the first_war milestone', () => {
    let s = newGame('DE', 5);
    s.relations.FR = -90;
    s.politicalCapital = 10;
    s = advanceTurn(s, { actions: ['declare_war'] });
    expect(s.warWith).not.toBeNull();
    expect(s.chronicle.some((c) => c.id === 'first_war')).toBe(true);
  });
});
