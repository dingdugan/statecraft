import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp } from '../util';

/** Population + aging. Runs first; downstream systems read its output. */
export function stepDemographics(s: GameState, _ctx: StepContext): GameState {
  s.population *= 1 + s.popGrowth;
  // low/negative growth → ages faster; high growth → trends younger (clamped)
  s.medianAge = clamp(s.medianAge + C.AGE_DRIFT * (C.TREND_POP_REF - s.popGrowth), 15, 60);
  return s;
}
