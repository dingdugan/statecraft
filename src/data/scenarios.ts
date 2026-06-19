// Selectable historical start scenarios. Each perturbs a fresh game's starting state;
// applied after newGame seeds the base state. See docs/spec-nation-sim.md (Scenarios).

import type { GameState } from '../engine/types';
import { clamp } from '../engine/util';

export interface Scenario {
  id: string;
  name: string;
  nameZh: string;
  descZh: string;
  apply: (s: GameState) => void;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'standard',
    name: 'Modern Day',
    nameZh: '现代开局',
    descZh: '2025 年的真实起点。',
    apply: () => {},
  },
  {
    id: 'debt_crisis',
    name: 'Debt Crisis',
    nameZh: '债务危机',
    descZh: '背负沉重债务与赤字、信用受损的危局开局。',
    apply: (s) => {
      s.debtPctGdp += 0.6;
      s.creditRating = clamp(s.creditRating - 6, 0, 20);
      s.approval = clamp(s.approval - 10, 0, 100);
      s.reserves *= 0.5;
    },
  },
  {
    id: 'cold_war',
    name: 'Cold War',
    nameZh: '冷战对峙',
    descZh: '阵营对立、军备紧张、外交敌意高涨的开局。',
    apply: (s) => {
      s.militaryReadiness = clamp(s.militaryReadiness + 12, 0, 100);
      for (const k of Object.keys(s.relations)) {
        s.relations[k] = clamp(s.relations[k] - 30, -100, 100);
      }
    },
  },
];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];
}
