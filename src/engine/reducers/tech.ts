import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, moveToward, spendShareGdp } from '../util';

/** R&D spend + education drive the tech level (a stock), which in turn feeds growth
 *  (in stepEconomy) and pulls productivity along. Runs before economy. */
export function stepTech(s: GameState, _ctx: StepContext): GameState {
  const rndAdequacy = Math.tanh(spendShareGdp(s, 'rnd') / C.REF.rnd); // ~0..1
  const techTarget = clamp(0.6 + 1.8 * rndAdequacy + C.TECH_EDU * (s.educationLevel - 50), 0.5, 3.0);
  s.techLevel = moveToward(s.techLevel, techTarget, C.TECH_STEP);
  s.productivity = moveToward(s.productivity, s.techLevel, 0.05);
  return s;
}
