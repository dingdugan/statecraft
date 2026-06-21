// Annual national focus (v3.1): each year the player commits to ONE strategic direction
// (mutually exclusive). Every focus is a real tradeoff — one axis surges, another aches —
// so picking it means giving up the others' window this year. One-time impulses; never
// touches the tax/spending levers. Applied in applyDecisions, surfaced live in the preview.

import type { GameState } from '../engine/types';
import type { StepContext } from '../engine/context';
import { clamp } from '../engine/util';

export interface FocusDef {
  id: string;
  labelZh: string;
  descZh: string;
  apply: (s: GameState, ctx: StepContext) => void;
}

export const FOCUSES: FocusDef[] = [
  {
    id: 'economy', labelZh: '拼经济', descZh: '全力发展：增长与就业大涨，代价是贫富分化、赤字扩大、排放上升。',
    apply: (s) => {
      s.gdp *= 1.02;
      s.unemployment = clamp(s.unemployment - 0.02, 0.01, 0.45);
      s.inequality = clamp(s.inequality + 0.03, 0.2, 0.7);
      s.reserves -= 0.012 * s.gdp;
      s.emissions = clamp(s.emissions + 3, 0, 200);
    },
  },
  {
    id: 'politics', labelZh: '稳政治', descZh: '集中维稳：支持率与稳定大涨、动荡退潮，但资源挤占拖慢了经济。',
    apply: (s) => {
      s.approval = clamp(s.approval + 6, 0, 100);
      s.unrest = clamp(s.unrest - 12, 0, 100);
      s.stability = clamp(s.stability + 4, 0, 100);
      s.gdp *= 0.99;
      s.reserves -= 0.008 * s.gdp;
    },
  },
  {
    id: 'military', labelZh: '强军备', descZh: '扩充军备：军力、战备大增、政变风险下降，但军费吞噬财政、民意微挫。',
    apply: (s) => {
      s.militaryStrength = clamp(s.militaryStrength + 6, 0, 100);
      s.militaryReadiness = clamp(s.militaryReadiness + 8, 0, 100);
      s.coupRisk = clamp(s.coupRisk - 6, 0, 100);
      s.reserves -= 0.025 * s.gdp;
      s.approval = clamp(s.approval - 3, 0, 100);
    },
  },
  {
    id: 'fiscal', labelZh: '修财政', descZh: '休养整顿：储备回血、信用回升、债务下降，但紧缩短期压增长、伤民意。',
    apply: (s) => {
      s.reserves += 0.02 * s.gdp;
      s.creditRating = clamp(s.creditRating + 1, 0, 20);
      s.debtPctGdp = Math.max(0, s.debtPctGdp - 0.03);
      s.approval = clamp(s.approval - 5, 0, 100);
      s.unrest = clamp(s.unrest + 8, 0, 100);
      s.gdp *= 0.99;
    },
  },
  {
    id: 'welfare', labelZh: '惠民生', descZh: '投入民生：健康、公平、民意齐升，代价是不小的财政开销。',
    apply: (s) => {
      s.healthIndex = clamp(s.healthIndex + 5, 0, 100);
      s.inequality = clamp(s.inequality - 0.03, 0.2, 0.7);
      s.approval = clamp(s.approval + 4, 0, 100);
      s.reserves -= 0.02 * s.gdp;
    },
  },
  {
    id: 'tech', labelZh: '攻科技', descZh: '押注未来：科技、生产力、教育跃升，但烧钱、且短期见不到回报。',
    apply: (s) => {
      s.techLevel = clamp(s.techLevel + 0.1, 0.5, 5);
      s.productivity = clamp(s.productivity + 0.03, 0.3, 3);
      s.educationLevel = clamp(s.educationLevel + 2, 0, 100);
      s.reserves -= 0.015 * s.gdp;
      s.approval = clamp(s.approval - 1, 0, 100);
    },
  },
];

export function getFocus(id: string): FocusDef | undefined {
  return FOCUSES.find((f) => f.id === id);
}
