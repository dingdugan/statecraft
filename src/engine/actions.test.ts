import { describe, it, expect } from 'vitest';
import { newGame, advanceTurn } from './index';
import { ACTIONS } from '../data/actions';

describe('actions (a) library integrity', () => {
  it('unique ids, positive cost, valid categories, sizable library', () => {
    const ids = new Set<string>();
    for (const a of ACTIONS) {
      expect(ids.has(a.id), `dup ${a.id}`).toBe(false);
      ids.add(a.id);
      expect(a.cost, a.id).toBeGreaterThan(0);
      expect(['diplo', 'military', 'domestic'], a.id).toContain(a.category);
    }
    expect(ACTIONS.length).toBeGreaterThanOrEqual(8);
  });
});

describe('actions (b) political capital accrues', () => {
  it('PC grows above the starting 5 after a turn', () => {
    let s = newGame('DE', 11);
    expect(s.politicalCapital).toBe(5);
    s = advanceTurn(s);
    expect(s.politicalCapital).toBeGreaterThan(5);
    expect(s.politicalCapital).toBeLessThanOrEqual(30);
  });
});

describe('actions (c) sue_peace ends a war', () => {
  it('spending PC on sue_peace clears warWith', () => {
    let s = newGame('DE', 9);
    s.warWith = 'FR';
    s.warScore = -10;
    s.politicalCapital = 10;
    s = advanceTurn(s, { actions: ['sue_peace'] });
    expect(s.warWith).toBeNull();
  });
});

describe('actions (d) declare_war gated by capital + hostility', () => {
  it('unaffordable → no war; affordable + hostile → war declared', () => {
    let poor = newGame('DE', 9);
    poor.relations.FR = -60;
    poor.politicalCapital = 2; // < cost 6
    poor = advanceTurn(poor, { actions: ['declare_war'] });
    expect(poor.warWith).toBeNull();

    let rich = newGame('DE', 9);
    rich.relations.FR = -60;
    rich.politicalCapital = 10;
    rich = advanceTurn(rich, { actions: ['declare_war'] });
    expect(rich.warWith).not.toBeNull();
  });
});
