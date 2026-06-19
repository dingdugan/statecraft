import type { GameState } from './types';
import type { StepContext } from './context';
import { C } from './constants';

/** Bankruptcy / revolution / end-year checks. See docs/design-engine.md §9. */
export function checkFailStates(s: GameState, ctx: StepContext): GameState {
  if (s.status !== 'playing') return s;

  s.victoryStreak = s.score >= 85 ? s.victoryStreak + 1 : 0;

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

  if (s.coupRisk >= 90) {
    s.status = 'coup';
    s.endReason = `军队倒戈、发动政变，你的政府于 ${ctx.year} 年被推翻。`;
    ctx.log.push({ kind: 'fail', msg: '⚔️ 军事政变 —— 政权易主。' });
    return s;
  }

  // victory conditions (checked after fail states — a collapsing state does not win)
  const gdpPerCap = (s.gdp * 1e9) / (s.population * 1e6);
  const allies = Object.values(s.relations).filter((r) => r > 40).length;
  let win: string | null = null;
  if (s.victoryStreak >= 5) win = '超级强国（治国评分长期居于 85+）';
  else if (gdpPerCap >= 100000 && s.qualityOfLife >= 70) win = '富庶之邦（人均 GDP 破 $100k、民生优渥）';
  else if (s.globalStanding >= 75 && allies >= 3 && !s.warWith && s.warExhaustion < 5)
    win = '世界调停者（声望卓著、盟友环绕、长享和平）';
  else if (s.climateStress <= 10 && s.qualityOfLife >= 80 && s.emissions <= 45)
    win = '绿色文明（低碳、高生活质量）';
  if (win) {
    s.status = 'victory';
    s.endReason = `达成「${win}」—— 你在 ${ctx.year} 年缔造了一个时代。`;
    ctx.log.push({ kind: 'info', msg: `🏆 胜利：${win}` });
    return s;
  }

  if (s.year >= C.END_YEAR) {
    s.status = 'ended';
    s.endReason = `执政至 ${C.END_YEAR} 年，留下最终治国评分。`;
    ctx.log.push({ kind: 'info', msg: '🏁 抵达终局之年。' });
  }
  return s;
}
