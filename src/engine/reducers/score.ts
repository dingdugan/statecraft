import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, sigmoid } from '../util';

/** Pure: compute prosperity (0..100) and composite score (geo-mean with stability). */
export function computeScore(s: GameState): void {
  // real (deflated) per-capita GDP so wealth reflects real prosperity, not inflation
  const realGdpPerCap = (s.gdp * 1e9) / (s.population * 1e6) / s.priceLevel;
  // each sub-band is clamped to its documented range (design-engine §4 step 5)
  const wealth = clamp(40 * (Math.log10(realGdpPerCap / C.REF_PC + 1) / Math.log10(11)), 0, 40);
  const growth = clamp(25 * sigmoid(s.gdpGrowthReal / 0.04), 0, 25);
  const jobs = clamp(20 * (1 - s.unemployment / 0.25), 0, 20);
  const prices = clamp(15 * (1 - Math.min(1, Math.abs(s.inflation - 0.02) / 0.1)), 0, 15);
  s.prosperity = clamp(wealth + growth + jobs + prices, 0, 100);

  // legitimacy: approval + quality of life, docked for inequality
  const ineqPenalty = clamp(((s.inequality - 0.25) / 0.4) * 100, 0, 100);
  s.legitimacy = clamp(0.45 * s.approval + 0.35 * s.qualityOfLife + 0.2 * (100 - ineqPenalty), 0, 100);

  // composite = geometric mean of prosperity × stability × legitimacy (0..100)
  s.score = clamp(
    Math.cbrt(Math.max(0, s.prosperity) * Math.max(0, s.stability) * Math.max(0, s.legitimacy)),
    0,
    100,
  );
}

export function stepScore(s: GameState, _ctx: StepContext): GameState {
  computeScore(s);
  return s;
}
