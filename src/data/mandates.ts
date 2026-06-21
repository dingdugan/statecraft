// Tenure mandates (v3.0): each game opens with one country-fitting objective so the
// player always knows what they're playing toward. Pure read-only views over GameState
// (progress 0..1 + a detail line) — no new simulated state, just a goal lens.

import type { GameState } from '../engine/types';
import { clamp } from '../engine/util';

export interface MandateDef {
  id: string;
  titleZh: string;
  descZh: string;
  progress: (s: GameState) => number; // 0..1
  detail: (s: GameState) => string; // e.g. "治国评分 72 / 85"
}

function realPerCap(s: GameState): number {
  return (s.gdp * 1e9) / (s.population * 1e6) / s.priceLevel;
}

export const MANDATES: MandateDef[] = [
  {
    id: 'superpower', titleZh: '缔造盛世', descZh: '任内把治国评分推上 85，跻身强国之列。',
    progress: (s) => clamp(s.score / 85, 0, 1),
    detail: (s) => `治国评分 ${s.score.toFixed(0)} / 85`,
  },
  {
    id: 'prosperity', titleZh: '国富民强', descZh: '把实际人均 GDP 拉到 $80k 的富裕水平。',
    progress: (s) => clamp(realPerCap(s) / 80000, 0, 1),
    detail: (s) => `人均 $${(realPerCap(s) / 1000).toFixed(0)}k / $80k`,
  },
  {
    id: 'green', titleZh: '绿色转型', descZh: '把排放强度压到 30 以下，同时守住财政（债务 < 100%）。',
    progress: (s) => clamp((100 - s.emissions) / 70, 0, 1) * (s.debtPctGdp < 1.0 ? 1 : 0.6),
    detail: (s) => `排放 ${s.emissions.toFixed(0)} / 30 · 债务 ${(s.debtPctGdp * 100).toFixed(0)}%`,
  },
  {
    id: 'stability', titleZh: '长治久安', descZh: '让稳定站上 90、动荡远离临界，安度任期。',
    progress: (s) => clamp(s.stability / 90, 0, 1),
    detail: (s) => `稳定 ${s.stability.toFixed(0)} / 90 · 动荡 ${s.unrest.toFixed(0)}`,
  },
  {
    id: 'deleverage', titleZh: '休养生息', descZh: '把公共债务降到 GDP 的 60% 以下。',
    progress: (s) => clamp((1.2 - s.debtPctGdp) / 0.6, 0, 1),
    detail: (s) => `债务 ${(s.debtPctGdp * 100).toFixed(0)}% / 60%`,
  },
];

export function getMandate(id: string): MandateDef | undefined {
  return MANDATES.find((m) => m.id === id);
}

/** Pick the mandate that best fits the country's opening predicament. */
export function pickMandate(s: GameState): string {
  if (s.emissions > 55 || s.traits.includes('oil_exporter')) return 'green';
  if (s.debtPctGdp > 1.0) return 'deleverage';
  if (s.stability < 55 || s.govType !== 'democracy') return 'stability';
  if (realPerCap(s) > 42000) return 'superpower';
  return 'prosperity';
}
