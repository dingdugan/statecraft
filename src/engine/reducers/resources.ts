import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, hasTrait, spendShareGdp } from '../util';

function resourceBaseFor(s: GameState): number {
  return hasTrait(s, 'oil_exporter') ? 0.12 : hasTrait(s, 'resource_rich') ? 0.06 : 0.01;
}

/** Pure: derive resource income (commodity exports as % of GDP) and emissions intensity. */
export function computeResources(s: GameState): void {
  const depletionFactor = 1 - s.resourceDepletion / 100;
  s.resourceIncome = clamp(resourceBaseFor(s) * s.commodityPrice * depletionFactor, 0, 0.3);
  const greenEffort = spendShareGdp(s, 'rnd') + spendShareGdp(s, 'infrastructure');
  s.emissions = clamp(
    40 + 60 * s.sectors.industry - 200 * Math.max(0, greenEffort - 0.05) + (hasTrait(s, 'oil_exporter') ? 15 : 0),
    0,
    100,
  );
}

/** Commodity-price cycle, resource income (→ reserves + growth), extraction depletion,
 *  and emissions → accumulating climate stress. Runs after diplomacy, before economy. */
export function stepResources(s: GameState, ctx: StepContext): GameState {
  // mean-reverting commodity-price random walk
  s.commodityPrice = clamp(0.8 * s.commodityPrice + 0.2 * 1.0 + ctx.rng.normal(0, C.COMMODITY_VOL), 0.4, 2.2);
  computeResources(s);
  if (resourceBaseFor(s) > 0.02) {
    s.resourceDepletion = clamp(s.resourceDepletion + C.DEPLETE_RATE * (s.resourceIncome / 0.1), 0, 100);
  }
  s.reserves += s.resourceIncome * s.gdp * 0.4; // commodity export earnings
  s.climateStress = clamp(s.climateStress + (s.emissions - 40) * C.CLIMATE_ACCUM, 0, 100);
  return s;
}
