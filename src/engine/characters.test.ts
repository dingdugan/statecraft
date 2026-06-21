import { describe, it, expect } from 'vitest';
import { generateFigures } from '../data/characters';
import { newWorld } from './index';

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
