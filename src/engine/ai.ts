import type { GameState, PendingDecisions } from './types';

/** Non-player country decision. v2.1 skeleton: hold current levers, enact nothing.
 *  v2.3 will replace this with rational behaviour (respond to unemployment/inflation/
 *  fiscal stress, adjust military by regime type, avoid provoking when weak). */
export function aiDecide(cs: GameState): PendingDecisions {
  return {
    taxRate: cs.taxRate,
    spendingPctGdp: cs.spendingPctGdp,
    allocation: { ...cs.allocation },
  };
}
