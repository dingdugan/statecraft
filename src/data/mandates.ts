// Tenure mandates (v3.0): each game opens with one country-fitting objective so the
// player always knows what they're playing toward. Pure read-only views over GameState
// (progress 0..1 + a detail line + a how-to-make-progress hint) — no new simulated state.

import type { GameState } from '../engine/types';
import { clamp } from '../engine/util';

export interface MandateDef {
  id: string;
  titleZh: string;
  descZh: string;
  hintZh: string; // how to actually move the needle (discoverability — v3.2)
  progress: (s: GameState) => number; // 0..1
  detail: (s: GameState) => string; // e.g. "治国评分 72 / 85"
}

function realPerCap(s: GameState): number {
  return (s.gdp * 1e9) / (s.population * 1e6) / s.priceLevel;
}

export const MANDATES: MandateDef[] = [
  {
    id: 'superpower', titleZh: '缔造盛世', descZh: '任内把治国评分推上 85，跻身强国之列。',
    hintZh: '评分 = 繁荣 × 稳定 × 合法性 的乘积，别偏科：稳增长、压动荡、提民生缺一不可。',
    progress: (s) => clamp(s.score / 85, 0, 1),
    detail: (s) => `治国评分 ${s.score.toFixed(0)} / 85`,
  },
  {
    id: 'prosperity', titleZh: '国富民强', descZh: '把实际人均 GDP 拉到 $80k 的富裕水平。',
    hintZh: '调高「教育」+「研发」预算拉升生产力与科技，推动长期实际增长（短期见效慢、要耐心）。',
    progress: (s) => clamp(realPerCap(s) / 80000, 0, 1),
    detail: (s) => `人均 $${(realPerCap(s) / 1000).toFixed(0)}k / $80k`,
  },
  {
    id: 'green', titleZh: '绿色转型', descZh: '把排放强度压到 30 以下。',
    hintZh: '调高「研发」+「基建」预算分配（两者合计需 >5%GDP 才开始减排，要明显降需 15%+），并在「能源转型」事件里选清洁能源。',
    progress: (s) => clamp((100 - s.emissions) / 70, 0, 1),
    detail: (s) => `排放 ${s.emissions.toFixed(0)} / 30`,
  },
  {
    id: 'stability', titleZh: '长治久安', descZh: '让稳定站上 90、动荡远离临界，安度任期。',
    hintZh: '提升「福利」「医疗」满意度、压低失业与通胀；动荡高时用「稳政治」国策或「维稳整肃」行动。',
    progress: (s) => clamp(s.stability / 90, 0, 1),
    detail: (s) => `稳定 ${s.stability.toFixed(0)} / 90 · 动荡 ${s.unrest.toFixed(0)}`,
  },
  {
    id: 'deleverage', titleZh: '休养生息', descZh: '把公共债务降到 GDP 的 60% 以下。',
    hintZh: '把「支出规模」压到税收以下（看预览的「赤字」转负即盈余）、提高税率，并用「修财政」国策直接降债。',
    progress: (s) => clamp((1.2 - s.debtPctGdp) / 0.6, 0, 1),
    detail: (s) => `债务 ${(s.debtPctGdp * 100).toFixed(0)}% / 60%`,
  },
];

export function getMandate(id: string): MandateDef | undefined {
  return MANDATES.find((m) => m.id === id);
}

/** Pick the mandate that best fits the country's opening predicament. Order matters:
 *  an existential problem (debt spiral, instability) outranks a long-horizon goal — a
 *  debt-242% country gets 降债, not an unwinnable 绿色转型. */
export function pickMandate(s: GameState): string {
  if (s.debtPctGdp > 1.0) return 'deleverage'; // debt crisis trumps everything
  if (s.stability < 55 || s.govType !== 'democracy') return 'stability';
  if (s.emissions > 55 || s.traits.includes('oil_exporter')) return 'green';
  if (realPerCap(s) > 42000) return 'superpower';
  return 'prosperity';
}
