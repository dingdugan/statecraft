// Player-enactable policies. MVP models persistent policies as one-shot patches to
// levers/state (no active-modifier registry yet — a clean later addition).
// See docs/design-engine.md §7.

import type { GameState } from '../engine/types';
import type { StepContext } from '../engine/context';
import { clamp } from '../engine/util';
import { SPEND_MAX, SPEND_MIN } from '../engine/constants';

export interface Policy {
  id: string;
  name: string;
  nameZh: string;
  desc: string;
  descZh: string;
  oneShot: boolean;
  available: (s: GameState) => boolean;
  apply: (s: GameState, ctx: StepContext) => void;
}

export const POLICIES: Policy[] = [
  {
    id: 'austerity',
    name: 'Austerity Package',
    nameZh: '紧缩方案',
    desc: 'Cut primary spending 3pp to repair the books. Painful now, credible later.',
    descZh: '削减 3 个百分点的基本支出修复财政。眼下很痛，但重建信用。',
    oneShot: true,
    available: (s) => s.deficitPctGdp > 0.03,
    apply: (s) => {
      s.spendingPctGdp = clamp(s.spendingPctGdp - 0.03, SPEND_MIN, SPEND_MAX);
      s.approval = clamp(s.approval - 8, 0, 100);
      s.unrest = clamp(s.unrest + 10, 0, 100);
      s.creditRating = clamp(s.creditRating + 1, 0, 20);
    },
  },
  {
    id: 'education_reform',
    name: 'Education Reform',
    nameZh: '教育改革',
    desc: 'A long-horizon human-capital bet. Raises education; pays off in productivity years later.',
    descZh: '面向长远的人力资本投资。提升教育水平，多年后兑现为生产率。',
    oneShot: true,
    available: (s) => s.allocation.education >= 0.1,
    apply: (s) => {
      s.educationLevel = clamp(s.educationLevel + 6, 0, 100);
      s.reserves -= 0.005 * s.gdp;
    },
  },
  {
    id: 'stimulus',
    name: 'Fiscal Stimulus',
    nameZh: '财政刺激',
    desc: 'Spend into the slump: short-term growth and jobs, at the cost of the deficit.',
    descZh: '逆周期增支：短期拉动增长与就业，代价是赤字扩大。',
    oneShot: true,
    available: (s) => s.unemployment > 0.07,
    apply: (s) => {
      // one-time impulse (jobs + demand) financed from reserves; not a permanent lever bump
      s.gdp *= 1.01;
      s.unemployment = clamp(s.unemployment - 0.015, 0.01, 0.45);
      s.approval = clamp(s.approval + 4, 0, 100);
      s.reserves -= 0.015 * s.gdp;
    },
  },
  {
    id: 'anticorruption',
    name: 'Anti-Corruption Drive',
    nameZh: '反腐行动',
    desc: 'Tighten the state. Improves tax compliance and approval; rattles elites short-term.',
    descZh: '整肃吏治。改善税收遵从与民意，但短期触动既得利益。',
    oneShot: true,
    available: (s) => s.traits.includes('fragile_institutions') || s.stability < 60,
    apply: (s) => {
      s.approval = clamp(s.approval + 6, 0, 100);
      s.stability = clamp(s.stability + 3, 0, 100);
      s.educationLevel = clamp(s.educationLevel + 1, 0, 100);
    },
  },
];
