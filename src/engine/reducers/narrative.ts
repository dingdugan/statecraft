import type { GameState } from '../types';
import type { StepContext } from '../context';
import { getCountry } from '../../data/countries';

/** A one-line narrative read on the year's mood, derived from the state. */
function yearNarrative(s: GameState): string {
  const bits: string[] = [];
  if (s.gdpGrowthReal > 0.035) bits.push('经济强劲扩张');
  else if (s.gdpGrowthReal < -0.01) bits.push('经济陷入收缩');
  else if (s.gdpGrowthReal < 0.012) bits.push('增长乏力');
  if (s.inflation > 0.08) bits.push('通胀高烧不退');
  else if (s.inflation < 0) bits.push('物价转入通缩');
  if (s.approval > 62) bits.push('政府广受拥戴');
  else if (s.approval < 35) bits.push('民意基础动摇');
  if (s.unrest > 55) bits.push('街头动荡四起');
  if (s.warWith) bits.push(`与${getCountry(s.warWith).nameZh}的战事仍在持续`);
  else if (s.debtPctGdp > 1.1) bits.push('债台高筑');
  if (!bits.length) return '这一年波澜不惊，国家稳步前行。';
  return bits.join('，') + '。';
}

interface Milestone {
  id: string;
  when: (s: GameState) => boolean;
  text: (s: GameState) => string;
}

const MILESTONES: Milestone[] = [
  { id: 'first_war', when: (s) => s.warWith !== null, text: (s) => `⚔️ 国家卷入战争（对手：${getCountry(s.warWith as string).nameZh}）` },
  { id: 'score70', when: (s) => s.score >= 70, text: () => '⭐ 治国评分首次站上 70，国家步入正轨' },
  { id: 'score85', when: (s) => s.score >= 85, text: () => '🏆 治国评分突破 85，迈入强国之列' },
  { id: 'debt100', when: (s) => s.debtPctGdp >= 1.0, text: () => '💸 公共债务突破 GDP 的 100%' },
  { id: 'unrest70', when: (s) => s.unrest >= 70, text: () => '🔥 社会动荡逼近临界点' },
  { id: 'tech2', when: (s) => s.techLevel >= 2.0, text: () => '🔬 科技水平迈入世界前沿' },
  { id: 'prosperity', when: (s) => s.prosperity >= 82, text: () => '🌟 国民繁荣指数达到顶尖水平' },
  { id: 'coup_scare', when: (s) => s.coupRisk >= 55, text: () => '🎖️ 军中异动，政变阴云笼罩' },
];

/** v2.6 narrative layer: append a year-mood line to the log, and record one-time
 *  milestones into the persistent chronicle. Runs after scoring, before events. */
export function stepNarrative(s: GameState, ctx: StepContext): GameState {
  ctx.log.push({ kind: 'info', msg: `📜 ${yearNarrative(s)}` });
  for (const m of MILESTONES) {
    if (m.when(s) && !s.chronicle.some((c) => c.id === m.id)) {
      const text = m.text(s);
      s.chronicle.push({ year: s.year, text, id: m.id });
      ctx.log.push({ kind: 'politics', msg: `🏛️ 史册 · ${text}` });
    }
  }
  return s;
}
