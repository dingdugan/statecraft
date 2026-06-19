import type { GameState, PendingDecisions } from './types';
import { clamp } from './util';

/** Non-player country decision (v2.3): a rational fiscal heuristic.
 *  - high unemployment (a slump) → loosen: spend a bit more, tax a bit less
 *  - high inflation or fiscal stress (big deficit / heavy debt) → consolidate: spend less, tax more
 *  - structurally loose but not yet stressed → drift spending back toward revenue
 *  Spending allocation is left at the country's standing tilt. Bounds keep every
 *  country in a sane fiscal band so NPCs don't passively spiral into collapse. */
export function aiDecide(cs: GameState): PendingDecisions {
  let tax = cs.taxRate;
  let spend = cs.spendingPctGdp;

  const slump = cs.unemployment > 0.1;
  const overheating = cs.inflation > 0.06;
  const fiscalStress = cs.deficitPctGdp > 0.06 || cs.debtPctGdp > 1.2;

  if (fiscalStress || overheating) {
    spend = clamp(spend - 0.015, 0.12, 0.65);
    tax = clamp(tax + 0.006, 0.12, 0.6);
  } else if (slump) {
    spend = clamp(spend + 0.012, 0.12, 0.65);
    tax = clamp(tax - 0.005, 0.12, 0.6);
  } else if (spend - tax * 0.85 > 0.04) {
    spend = clamp(spend - 0.008, 0.12, 0.65);
  }

  return { taxRate: tax, spendingPctGdp: spend, allocation: { ...cs.allocation } };
}
