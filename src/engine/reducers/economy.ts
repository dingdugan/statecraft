import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, spendEffect } from '../util';

/** Realized real growth → nominal GDP, inflation, unemployment, productivity.
 *  See docs/design-engine.md §4 step 2. Reads last turn's deficit (fiscal runs after). */
export function stepEconomy(s: GameState, ctx: StepContext): GameState {
  const infraEff = spendEffect(s, 'infrastructure', C.GAIN_GROWTH);
  const eduEff = C.K_EDU * ((s.educationLevel - 50) / 50);
  const techBonus = C.K_TECH_GROWTH * (s.techLevel - 1); // R&D's growth effect flows via techLevel
  const agingDrag = C.K_AGE * (Math.max(0, s.medianAge - 42) / 10);
  const taxDrag = C.K_TAXDRAG * Math.max(0, s.taxRate - 0.52);
  const instDrag = C.K_INST * ((100 - s.stability) / 100);

  const potential =
    s.trendGrowth + infraEff + techBonus + eduEff +
    C.K_TRADE * s.tradeBalance - C.K_SANCTION * (s.sanctionPressure / 100) -
    agingDrag - taxDrag - instDrag;
  const realGrowth = clamp(potential + ctx.rng.normal(0, C.GROWTH_SD), -0.15, 0.15);
  s.gdpGrowthReal = realGrowth;

  // inflation: anchored ~2%, plus overheating gap + deficit pressure + noise
  s.inflation = clamp(
    s.inflation * C.INFL_PERSIST +
      (1 - C.INFL_PERSIST) * 0.02 +
      C.K_INFL_GAP * (realGrowth - s.trendGrowth) +
      C.K_INFL_DEF * Math.max(0, s.deficitPctGdp - 0.03) +
      ctx.rng.normal(0, C.INFL_SD),
    -0.05,
    0.4,
  );

  s.gdp *= (1 + realGrowth) * (1 + s.inflation); // nominal

  // Okun-ish unemployment reaction + mean reversion to natural rate
  s.unemployment = clamp(
    s.unemployment + C.K_OKUN * (s.trendGrowth - realGrowth) + C.U_MEANREV * (C.NAT_U - s.unemployment),
    0.01,
    0.45,
  );

  // productivity is now driven by techLevel in stepTech (runs before this)
  return s;
}
