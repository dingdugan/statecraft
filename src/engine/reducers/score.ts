import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, sigmoid } from '../util';

/** Pure: compute prosperity (0..100) and composite score (geo-mean with stability). */
export function computeScore(s: GameState): void {
  const gdpPerCap = (s.gdp * 1e9) / (s.population * 1e6); // USD
  const wealth = 40 * (Math.log10(gdpPerCap / C.REF_PC + 1) / Math.log10(11));
  const growth = 25 * sigmoid(s.gdpGrowthReal / 0.04);
  const jobs = 20 * (1 - s.unemployment / 0.25);
  const prices = 15 * (1 - Math.min(1, Math.abs(s.inflation - 0.02) / 0.1));
  s.prosperity = clamp(wealth + growth + jobs + prices, 0, 100);
  s.score = clamp(Math.sqrt(Math.max(0, s.prosperity) * Math.max(0, s.stability)), 0, 100);
}

export function stepScore(s: GameState, _ctx: StepContext): GameState {
  computeScore(s);
  return s;
}
