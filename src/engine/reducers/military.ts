import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, moveToward, spendShareGdp, hasTrait } from '../util';

/** Readiness (current funding adequacy), strength (slow stock from funding + tech +
 *  manpower), and coup risk (an idle/underpaid army plus instability, modulated by
 *  regime type). Runs after politics so coup risk reflects this year's stability. */
export function stepMilitary(s: GameState, _ctx: StepContext): GameState {
  const milSpend = spendShareGdp(s, 'military');
  const readinessTarget = clamp(100 * Math.tanh(milSpend / C.REF.military), 0, 100);
  s.militaryReadiness = moveToward(s.militaryReadiness, readinessTarget, C.MIL_READY_STEP);

  const strengthTarget = clamp(
    0.5 * s.militaryReadiness + 30 * ((s.techLevel - 0.5) / 2.5) + 10 * Math.tanh(s.population / 200),
    0,
    100,
  );
  s.militaryStrength = moveToward(s.militaryStrength, strengthTarget, C.MIL_STR_STEP);

  // democracies rarely coup; authoritarian/monarchy more prone; fragile states worse
  const govCoup =
    s.govType === 'democracy' ? -15 : s.govType === 'authoritarian' ? 10 : s.govType === 'monarchy' ? 5 : 0;
  s.coupRisk = clamp(
    (60 - s.militaryReadiness) * 0.4 +
      (50 - s.stability) * 0.5 +
      (50 - s.approval) * 0.2 +
      govCoup +
      (hasTrait(s, 'fragile_institutions') ? 15 : 0),
    0,
    100,
  );
  return s;
}
