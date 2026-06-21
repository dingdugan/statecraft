import type { GameState } from '../types';
import type { StepContext } from '../context';
import { TAX_MIN, TAX_MAX, SPEND_MIN, SPEND_MAX } from '../constants';
import { clamp, normalizeAllocation } from '../util';
import { POLICIES } from '../../data/policies';
import { getAction } from '../../data/actions';
import { getFocus } from '../../data/focuses';

/** Apply the player's pending decisions (levers + enacted policies). Runs first. */
export function applyDecisions(s: GameState, ctx: StepContext): GameState {
  const d = ctx.decisions;
  if (d.taxRate !== undefined) s.taxRate = clamp(d.taxRate, TAX_MIN, TAX_MAX);
  if (d.spendingPctGdp !== undefined) s.spendingPctGdp = clamp(d.spendingPctGdp, SPEND_MIN, SPEND_MAX);
  if (d.allocation) s.allocation = normalizeAllocation(d.allocation);
  if (d.enactPolicyIds) {
    for (const id of d.enactPolicyIds) {
      const p = POLICIES.find((x) => x.id === id);
      if (!p || !p.available(s)) continue;
      if (p.oneShot && s.usedPolicyIds.includes(id)) continue; // already fired — no re-ratchet
      p.apply(s, ctx);
      if (p.oneShot) s.usedPolicyIds.push(id);
      ctx.log.push({ kind: 'info', msg: `政策：${p.nameZh}` });
    }
  }
  // annual national focus (v3.1): one mutually-exclusive strategic bet, applied up front
  if (d.focus) {
    const f = getFocus(d.focus);
    if (f) {
      f.apply(s, ctx);
      ctx.log.push({ kind: 'politics', msg: `🎯 国策：${f.labelZh}` });
    }
  }
  // active actions (v2.5): spend political capital on proactive diplomatic/military/domestic moves
  if (d.actions) {
    for (const id of d.actions) {
      const a = getAction(id);
      if (!a || !a.available(s) || s.politicalCapital < a.cost) continue;
      s.politicalCapital -= a.cost;
      a.apply(s, ctx);
      ctx.log.push({ kind: 'politics', msg: `行动：${a.labelZh}` });
    }
  }
  // accrue political capital for next turn (from approval + stability), capped
  s.politicalCapital = clamp(s.politicalCapital + s.approval / 22 + s.stability / 28, 0, 30);
  return s;
}
