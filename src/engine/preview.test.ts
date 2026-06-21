import { describe, it, expect } from 'vitest';
import { newWorld, previewTurn, advanceTurn } from './index';
import { worldFingerprint } from './save';
import { getMandate } from '../data/mandates';

describe('preview (a) is a pure dry-run', () => {
  it('previewTurn does not mutate the world', () => {
    const w = newWorld('DE', 123);
    const fp = worldFingerprint(w);
    previewTurn(w.countries.DE, { taxRate: 0.5, spendingPctGdp: 0.6 });
    expect(worldFingerprint(w)).toBe(fp);
  });
});

describe('preview (b) equals the real player-country advance', () => {
  it('previewTurn is exactly advanceTurn on the player country (same rng, same decisions)', () => {
    const w = newWorld('DE', 123);
    const d = { spendingPctGdp: 0.5, taxRate: 0.45 };
    const preview = previewTurn(w.countries.DE, d)!;
    const direct = advanceTurn(w.countries.DE, d);
    expect(preview.gdp).toBe(direct.gdp);
    expect(preview.score).toBe(direct.score);
    expect(preview.approval).toBe(direct.approval);
    expect(preview.deficitPctGdp).toBe(direct.deficitPctGdp);
  });
});

describe('preview (c) null when the player cannot advance', () => {
  it('returns null while an event is pending', () => {
    const w = newWorld('DE', 123);
    w.countries.DE.pendingEventId = 'whatever';
    expect(previewTurn(w.countries.DE, {})).toBeNull();
  });
});

describe('mandate (a) assigned at start, progress bounded', () => {
  it('every fresh country gets a valid mandate with progress in 0..1', () => {
    const w = newWorld('NG', 77);
    const s = w.countries.NG;
    expect(s.mandateId).toBeTruthy();
    const m = getMandate(s.mandateId);
    expect(m).toBeTruthy();
    const p = m!.progress(s);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(typeof m!.detail(s)).toBe('string');
  });
});
