import { Rng } from './rng';
import type { GameState, PendingDecisions } from './types';
import type { StepContext } from './context';
import { applyDecisions } from './reducers/decisions';
import { stepDemographics } from './reducers/demographics';
import { stepTech } from './reducers/tech';
import { stepDiplomacy } from './reducers/diplomacy';
import { stepEconomy } from './reducers/economy';
import { stepFiscal } from './reducers/fiscal';
import { stepSocial } from './reducers/social';
import { stepPolitics } from './reducers/politics';
import { stepMilitary } from './reducers/military';
import { stepWar } from './reducers/war';
import { stepScore } from './reducers/score';
import { maybeFireEvent } from './reducers/events';
import { checkFailStates } from './failStates';

/** Advance one year. Pure: clones, threads a single RNG through reducers in fixed
 *  order, persists the advanced RNG cursor. See docs/design-engine.md §3. */
export function advanceTurn(state: GameState, decisions: PendingDecisions = {}): GameState {
  if (state.status !== 'playing') return state;
  if (state.pendingEventId) {
    throw new Error('resolve the pending event before advancing the turn');
  }
  const s: GameState = structuredClone(state);
  const ctx: StepContext = { rng: new Rng(s.rng), year: s.year, decisions, log: [] };

  applyDecisions(s, ctx);
  stepDemographics(s, ctx);
  stepTech(s, ctx);
  stepDiplomacy(s, ctx);
  stepEconomy(s, ctx);
  stepFiscal(s, ctx);
  stepSocial(s, ctx);
  stepPolitics(s, ctx);
  stepMilitary(s, ctx);
  stepWar(s, ctx);
  stepScore(s, ctx);
  maybeFireEvent(s, ctx);
  checkFailStates(s, ctx);

  s.year += 1;
  s.turn += 1;
  s.rng = ctx.rng.state;
  s.log = ctx.log;
  return s;
}
