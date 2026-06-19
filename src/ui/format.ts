import type { GameState, GovType, SpendCategory } from '../engine/types';
import { clamp, round } from '../engine/util';

export function fmtMoney(bn: number): string {
  const a = Math.abs(bn);
  if (a >= 1000) return `${bn < 0 ? '−' : ''}$${(a / 1000).toFixed(2)}万亿`;
  return `${bn < 0 ? '−' : ''}$${a.toFixed(0)}十亿`;
}
export function fmtMoneyShort(bn: number): string {
  const a = Math.abs(bn);
  if (a >= 1000) return `${bn < 0 ? '−' : ''}$${(a / 1000).toFixed(1)}T`;
  return `${bn < 0 ? '−' : ''}$${a.toFixed(0)}B`;
}
export function fmtPct(frac: number, dp = 1): string {
  return `${(frac * 100).toFixed(dp)}%`;
}
export function fmtSigned(frac: number, dp = 1): string {
  const v = frac * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;
}
export function fmtPop(millions: number): string {
  if (millions >= 1000) return `${(millions / 1000).toFixed(2)} 亿`;
  return `${millions.toFixed(millions < 20 ? 1 : 0)} 百万`;
}

export const SPEND_LABELS: Record<SpendCategory, string> = {
  military: '国防',
  education: '教育',
  healthcare: '医疗',
  infrastructure: '基建',
  welfare: '福利',
  rnd: '研发',
};

export const GOV_LABELS: Record<GovType, string> = {
  democracy: '民主制',
  authoritarian: '威权制',
  monarchy: '君主制',
  hybrid: '混合制',
};

const RATING_TIERS = [
  'D', 'C', 'C', 'CC', 'CCC', 'B-', 'B', 'B+', 'BB-', 'BB', 'BB+', 'BBB-', 'BBB',
  'BBB+', 'A-', 'A', 'A+', 'AA-', 'AA', 'AA+', 'AAA',
];
export function ratingLabel(r: number): string {
  return RATING_TIERS[clamp(round(r, 0), 0, 20)] ?? 'NR';
}

export interface Briefing {
  who: string;
  msg: string;
  tone: 'good' | 'warn' | 'bad';
}

/** The delight layer: cabinet ministers surface the most salient issues as terse
 *  briefings on top of the raw numbers. Prioritized, most urgent first. */
export function briefings(s: GameState): Briefing[] {
  const out: Briefing[] = [];
  const FIN = '财政大臣';
  const ECON = '经济顾问';
  const HOME = '内政大臣';

  // fiscal
  if (s.creditRating <= 3 && s.deficitPctGdp > 0)
    out.push({ who: FIN, msg: `信用评级跌至 ${ratingLabel(s.creditRating)}，市场几乎不再借钱给我们。`, tone: 'bad' });
  else if (s.deficitPctGdp > 0.06)
    out.push({ who: FIN, msg: `赤字已达 GDP 的 ${fmtPct(s.deficitPctGdp)}，债务在累积。`, tone: 'warn' });
  else if (s.deficitPctGdp < -0.01)
    out.push({ who: FIN, msg: `财政盈余 ${fmtPct(-s.deficitPctGdp)}，储备在增厚。`, tone: 'good' });
  if (s.debtPctGdp > 1.5)
    out.push({ who: FIN, msg: `公共债务已是 GDP 的 ${fmtPct(s.debtPctGdp, 0)}，利息开始挤压预算。`, tone: 'warn' });

  // economy
  if (s.inflation > 0.1)
    out.push({ who: ECON, msg: `通胀高达 ${fmtPct(s.inflation)}，民众的钱包在缩水。`, tone: 'bad' });
  else if (s.inflation < 0)
    out.push({ who: ECON, msg: `物价在下跌（${fmtPct(s.inflation)}），通缩风险抬头。`, tone: 'warn' });
  if (s.unemployment > 0.12)
    out.push({ who: ECON, msg: `失业率 ${fmtPct(s.unemployment)}，街上的人在找活干。`, tone: 'bad' });
  if (s.gdpGrowthReal > 0.03)
    out.push({ who: ECON, msg: `经济实际增长 ${fmtSigned(s.gdpGrowthReal)}，势头不错。`, tone: 'good' });
  else if (s.gdpGrowthReal < 0)
    out.push({ who: ECON, msg: `经济在收缩（${fmtSigned(s.gdpGrowthReal)}）。`, tone: 'warn' });
  if (s.techLevel > 1.8)
    out.push({ who: '科技顾问', msg: `科技水平领先（${s.techLevel.toFixed(2)}），生产率持续走高。`, tone: 'good' });
  else if (s.techLevel < 0.8)
    out.push({ who: '科技顾问', msg: `科技基础薄弱（${s.techLevel.toFixed(2)}），增长后劲不足。`, tone: 'warn' });

  // politics
  if (s.unrest >= 70)
    out.push({ who: HOME, msg: `社会动荡指数 ${s.unrest.toFixed(0)}，局势濒临失控。`, tone: 'bad' });
  else if (s.unrest >= 45)
    out.push({ who: HOME, msg: `民怨累积（动荡 ${s.unrest.toFixed(0)}），需要安抚。`, tone: 'warn' });
  if (s.approval < 35)
    out.push({ who: HOME, msg: `支持率仅 ${s.approval.toFixed(0)}，民意正在流失。`, tone: 'bad' });
  else if (s.approval > 65)
    out.push({ who: HOME, msg: `支持率 ${s.approval.toFixed(0)}，民众站在你这边。`, tone: 'good' });
  if (s.govType === 'democracy' && s.termYearsLeft <= 1 && s.status === 'playing')
    out.push({ who: HOME, msg: `大选临近（剩 ${s.termYearsLeft} 年），支持率低于 35 将失去政权。`, tone: 'warn' });

  // social
  const SOC = '民政大臣';
  if (s.inequality > 0.55)
    out.push({ who: SOC, msg: `贫富差距悬殊（基尼 ${s.inequality.toFixed(2)}），社会裂痕加深。`, tone: 'bad' });
  else if (s.inequality > 0.45)
    out.push({ who: SOC, msg: `不平等在扩大（基尼 ${s.inequality.toFixed(2)}）。`, tone: 'warn' });
  if (s.healthIndex < 45)
    out.push({ who: SOC, msg: `医疗体系薄弱（健康指数 ${s.healthIndex.toFixed(0)}）。`, tone: 'warn' });

  if (out.length === 0)
    out.push({ who: '内阁', msg: '各项指标平稳，无紧急事项。', tone: 'good' });

  return out.slice(0, 5);
}
