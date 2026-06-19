import type { GameState } from '../types';
import type { StepContext } from '../context';
import { C } from '../constants';
import { clamp, moveToward, servicesSatisfaction } from '../util';
import { govStabBonus } from '../gov';

/** Approval, unrest accumulator, stability, and (democracies) elections.
 *  See docs/design-engine.md §4 step 4. */
export function stepPolitics(s: GameState, ctx: StepContext): GameState {
  const servicesSat = servicesSatisfaction(s); // 0..1
  const taxPain = C.K_TAXPAIN * Math.max(0, s.taxRate - 0.35);

  const dApproval =
    C.W_GROWTH * (s.gdpGrowthReal * 100) -
    C.W_UNEMP * ((s.unemployment - C.NAT_U) * 100) -
    C.W_INFL * Math.max(0, s.inflation - 0.04) * 100 +
    C.W_SERV * (servicesSat - 0.5) * 20 -
    taxPain * 30;

  s.approval = clamp(
    s.approval + dApproval + C.A_MEANREV * (50 - s.approval) + ctx.rng.normal(0, 2),
    0,
    100,
  );

  // Bad governance drives unrest; decay is capped so a high "stability floor"
  // (authoritarian bonus) can't fully suppress unrest from a collapsing approval.
  s.unrest = clamp(
    s.unrest +
      Math.max(0, (45 - s.approval) / 6) +
      Math.max(0, s.unemployment - 0.1) * 60 +
      Math.max(0, s.inflation - 0.06) * 40 -
      Math.min(4, C.UNREST_DECAY * (s.stability / 100)),
    0,
    100,
  );

  const stabTarget = clamp(0.6 * s.approval + 0.4 * (100 - s.unrest) + govStabBonus(s.govType), 0, 100);
  s.stability = moveToward(s.stability, stabTarget, C.STAB_MAX_STEP);
  s.lowStabilityStreak = s.stability <= 5 ? s.lowStabilityStreak + 1 : 0;

  // elections (democracies only)
  if (s.govType === 'democracy') {
    s.termYearsLeft -= 1;
    if (s.termYearsLeft <= 0) {
      if (s.approval < C.ELECTION_LOSE_BELOW) {
        s.status = 'voted_out';
        s.endReason = `选民在 ${ctx.year} 年大选中把你赶下了台（支持率仅 ${Math.round(s.approval)}）。`;
        ctx.log.push({ kind: 'politics', msg: '🗳️ 大选失利 —— 政府更迭。' });
      } else {
        s.termYearsLeft = C.TERM_LENGTH;
        s.approval = clamp(s.approval - 5, 0, 100);
        ctx.log.push({ kind: 'politics', msg: '🗳️ 连任成功（竞选略微消耗支持率）。' });
      }
    }
  }
  return s;
}
