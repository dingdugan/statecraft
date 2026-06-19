import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C, SPEND_MIN } from '../constants';
import { clamp, moveToward } from '../util';
import { govRatingBonus } from '../gov';

/** 0..20 rating → annual interest rate. AAA(20)=1.5%, mid(10)=6.5%, D(0)=11.5%.
 *  Gentle enough that a healthy state sits at r < nominal-g (sustainable), while a
 *  junk rating still bites. */
export function interestRate(rating: number): number {
  return 0.015 + ((20 - clamp(rating, 0, 20)) / 20) * 0.1;
}

/** Revenue, deficit, the standard debt/GDP recurrence, rating drift, market access.
 *  See docs/design-engine.md §4 step 3, §5. */
export function stepFiscal(s: GameState, ctx: StepContext): GameState {
  const laffer = C.K_LAFFER * Math.max(0, s.taxRate - 0.52);
  const compliance = clamp(
    0.6 + 0.3 * (s.stability / 100) + 0.1 * (s.educationLevel / 100) - laffer,
    0.4,
    1.0,
  );
  const revenuePct = s.taxRate * compliance;
  // cheap_debt (deep domestic markets / reserve currency, e.g. Japan's JGBs) caps
  // borrowing cost — high debt is sustainable while rates stay near-zero (fragile to shocks)
  let i = interestRate(s.creditRating);
  if (s.traits.includes('cheap_debt')) i *= 0.25;
  const interestPct = s.debtPctGdp * i;
  const primaryDef = s.spendingPctGdp - revenuePct; // excludes interest
  s.deficitPctGdp = primaryDef + interestPct;

  const lockedOut = s.marketAccessLostYears > 0;
  const gNom = (1 + s.gdpGrowthReal) * (1 + s.inflation) - 1;
  // when locked out, new borrowing is impossible → primary gap is reserve-financed, not added to debt
  const debtPrimary = lockedOut ? 0 : primaryDef;
  s.debtPctGdp = Math.max(0, (s.debtPctGdp * (1 + i)) / (1 + gNom) + debtPrimary);

  // reserves: surpluses accumulate; if locked out, deficits burn reserves
  if (s.deficitPctGdp < 0) {
    s.reserves += -s.deficitPctGdp * s.gdp;
  } else if (lockedOut) {
    s.reserves -= s.deficitPctGdp * s.gdp;
  }

  // credit rating drifts (max 2 notches/yr) toward a debt/deficit-driven target
  // debt weighed at 5 (not 8) so high-debt-but-disciplined states (e.g. Japan) stay
  // investable; a deficit blowup still craters the rating via the 40x deficit term.
  const target = clamp(
    20 - s.debtPctGdp * 5 - Math.max(0, s.deficitPctGdp) * 40 + govRatingBonus(s.govType, s.traits),
    0,
    20,
  );
  s.creditRating = moveToward(s.creditRating, target, C.RATING_MAX_STEP);

  // market access lost when rating floors and a deficit persists
  if (s.creditRating <= 3 && s.deficitPctGdp > 0) s.marketAccessLostYears += 1;
  else s.marketAccessLostYears = 0;

  // locked out AND reserves exhausted → forced austerity (and bankruptcy is checked later)
  if (s.marketAccessLostYears > 0 && s.reserves < 0) {
    s.spendingPctGdp = Math.max(SPEND_MIN, revenuePct);
    s.approval = clamp(s.approval - 10, 0, 100);
    s.unrest = clamp(s.unrest + 15, 0, 100);
    ctx.log.push({ kind: 'fiscal', msg: '市场融资关闭、储备见底 —— 被迫紧急紧缩。' });
  }
  return s;
}
