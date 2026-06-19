import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, moveToward, spendShareGdp } from '../util';

/** Quality of life from health + education, penalized by inequality and joblessness.
 *  Pure; used by both stepSocial and newGame so turn 0 displays a real value. */
export function computeQol(s: GameState): void {
  const ineqPenalty = clamp(((s.inequality - 0.25) / 0.4) * 100, 0, 100);
  s.qualityOfLife = clamp(
    0.45 * s.healthIndex +
      0.3 * s.educationLevel +
      0.25 * (100 - ineqPenalty) -
      100 * Math.max(0, s.unemployment - 0.08) -
      0.12 * s.climateStress,
    0,
    100,
  );
}

/** Health index + inequality dynamics, then quality of life. Runs after fiscal and
 *  before politics — its outputs feed unrest (inequality) and legitimacy (QoL). */
export function stepSocial(s: GameState, _ctx: StepContext): GameState {
  // health index drifts toward a target set by healthcare spend adequacy + education
  const healthTarget = clamp(
    40 + 50 * Math.tanh(spendShareGdp(s, 'healthcare') / C.REF.healthcare) + 0.1 * s.educationLevel,
    0,
    100,
  );
  s.healthIndex = moveToward(s.healthIndex, healthTarget, C.HEALTH_STEP);

  // inequality rises with unemployment; falls with welfare adequacy + education
  const welfareRelief = C.INEQ_WELFARE * Math.tanh(spendShareGdp(s, 'welfare') / C.REF.welfare - 0.5);
  const ineqPressure =
    C.INEQ_UNEMP * (s.unemployment - 0.05) -
    welfareRelief -
    C.INEQ_EDU * ((s.educationLevel - 50) / 50);
  s.inequality = clamp(s.inequality + ineqPressure, 0.2, 0.7);

  computeQol(s);
  return s;
}
