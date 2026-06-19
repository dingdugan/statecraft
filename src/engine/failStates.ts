import type { GameState } from './types';
import type { StepContext } from './context';
import { C } from './constants';

/** Bankruptcy / revolution / end-year checks. See docs/design-engine.md §9. */
export function checkFailStates(s: GameState, ctx: StepContext): GameState {
  if (s.status !== 'playing') return s;

  if (s.marketAccessLostYears >= 2 && s.reserves <= 0) {
    s.status = 'bankrupt';
    s.endReason = `失去市场融资且储备枯竭，国家于 ${ctx.year} 年主权违约。`;
    ctx.log.push({ kind: 'fail', msg: '💥 主权违约 —— 破产。' });
    return s;
  }

  if (s.unrest >= 90 || s.lowStabilityStreak >= 2) {
    s.status = 'revolution';
    s.endReason = `民怨沸腾、秩序崩解，政权于 ${ctx.year} 年被推翻。`;
    ctx.log.push({ kind: 'fail', msg: '🔥 革命 —— 政权倾覆。' });
    return s;
  }

  if (s.year >= C.END_YEAR) {
    s.status = 'ended';
    s.endReason = `执政至 ${C.END_YEAR} 年，留下最终治国评分。`;
    ctx.log.push({ kind: 'info', msg: '🏁 抵达终局之年。' });
  }
  return s;
}
