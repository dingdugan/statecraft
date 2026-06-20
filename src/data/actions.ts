// Active actions (v2.5): each turn the player may spend political capital on proactive
// moves — diplomacy, military, domestic — on top of budget/policy levers. Effects are
// one-time impulses (they never ratchet the tax/spending levers). NPCs don't use these yet.

import type { GameState } from '../engine/types';
import type { StepContext } from '../engine/context';
import { clamp } from '../engine/util';

export type ActionCategory = 'diplo' | 'military' | 'domestic';

export interface ActionDef {
  id: string;
  category: ActionCategory;
  labelZh: string;
  descZh: string;
  cost: number; // political capital
  available: (s: GameState) => boolean;
  apply: (s: GameState, ctx: StepContext) => void;
}

function randomTarget(s: GameState, ctx: StepContext): string | null {
  const ids = Object.keys(s.relations);
  return ids.length ? ids[Math.floor(ctx.rng.next() * ids.length)] : null;
}
function mostHostile(s: GameState): string | null {
  const ids = Object.keys(s.relations);
  if (!ids.length) return null;
  return ids.reduce((a, b) => ((s.relations[b] ?? 0) < (s.relations[a] ?? 0) ? b : a));
}

export const ACTIONS: ActionDef[] = [
  // ─── diplomacy ───────────────────────────────────────────────────────────────
  {
    id: 'befriend', category: 'diplo', labelZh: '外交示好', cost: 3,
    descZh: '向一个国家释放善意，改善双边关系、略升声望。',
    available: (s) => Object.keys(s.relations).length > 0,
    apply: (s, ctx) => { const t = randomTarget(s, ctx); if (t) s.relations[t] = clamp((s.relations[t] ?? 0) + 14, -100, 100); s.globalStanding = clamp(s.globalStanding + 1, 0, 100); },
  },
  {
    id: 'sanction', category: 'diplo', labelZh: '施压制裁', cost: 4,
    descZh: '对最敌对的国家施加制裁，彰显强硬，代价是贸易受损。',
    available: (s) => Object.values(s.relations).some((r) => r < 0),
    apply: (s) => { const t = mostHostile(s); if (t) s.relations[t] = clamp((s.relations[t] ?? 0) - 14, -100, 100); s.tradeBalance = clamp(s.tradeBalance - 0.01, -0.1, 0.12); s.approval = clamp(s.approval + 2, 0, 100); },
  },
  {
    id: 'mediate', category: 'diplo', labelZh: '斡旋调解', cost: 3,
    descZh: '在国际舞台扮演调停者，提升声望与多边关系。',
    available: (s) => s.globalStanding > 40,
    apply: (s) => { s.globalStanding = clamp(s.globalStanding + 4, 0, 100); for (const id of Object.keys(s.relations)) s.relations[id] = clamp((s.relations[id] ?? 0) + 3, -100, 100); },
  },
  // ─── military ────────────────────────────────────────────────────────────────
  {
    id: 'mobilize', category: 'military', labelZh: '动员备战', cost: 4,
    descZh: '提升军队战备以威慑对手——消耗一部分财政储备。',
    available: () => true,
    apply: (s) => { s.militaryReadiness = clamp(s.militaryReadiness + 8, 0, 100); s.reserves -= 0.012 * s.gdp; },
  },
  {
    id: 'declare_war', category: 'military', labelZh: '宣战', cost: 6,
    descZh: '对最敌对的国家宣战。慎用——战争代价高昂。',
    available: (s) => !s.warWith && Object.values(s.relations).some((r) => r < -25),
    apply: (s) => { const t = mostHostile(s); if (t) { s.warWith = t; s.warScore = 0; s.relations[t] = clamp((s.relations[t] ?? 0) - 20, -100, 100); s.militaryReadiness = clamp(s.militaryReadiness + 4, 0, 100); } },
  },
  {
    id: 'sue_peace', category: 'military', labelZh: '求和停战', cost: 4,
    descZh: '主动谋求停战，结束消耗、缓和关系。',
    available: (s) => s.warWith !== null,
    apply: (s) => { if (s.warWith) { s.relations[s.warWith] = clamp((s.relations[s.warWith] ?? 0) + 25, -100, 100); s.warWith = null; s.warScore = 0; s.warExhaustion = clamp(s.warExhaustion - 15, 0, 100); } },
  },
  // ─── domestic ────────────────────────────────────────────────────────────────
  {
    id: 'propaganda', category: 'domestic', labelZh: '舆论宣传', cost: 3,
    descZh: '一场宣传攻势，短期提振支持、平息躁动，略损公信。',
    available: () => true,
    apply: (s) => { s.approval = clamp(s.approval + 5, 0, 100); s.unrest = clamp(s.unrest - 8, 0, 100); s.legitimacy = clamp(s.legitimacy - 1, 0, 100); },
  },
  {
    id: 'crackdown', category: 'domestic', labelZh: '维稳整肃', cost: 4,
    descZh: '高压维稳，压制动荡——代价是民心与合法性。',
    available: (s) => s.unrest > 20,
    apply: (s) => { s.unrest = clamp(s.unrest - 18, 0, 100); s.stability = clamp(s.stability + 4, 0, 100); s.approval = clamp(s.approval - 5, 0, 100); s.legitimacy = clamp(s.legitimacy - 3, 0, 100); },
  },
  {
    id: 'reform', category: 'domestic', labelZh: '推动改革', cost: 5,
    descZh: '一揽子改革，降低不平等、提升合法性，但触动既得利益。',
    available: () => true,
    apply: (s) => { s.inequality = clamp(s.inequality - 0.02, 0.2, 0.7); s.legitimacy = clamp(s.legitimacy + 4, 0, 100); s.reserves -= 0.012 * s.gdp; s.approval = clamp(s.approval - 2, 0, 100); },
  },
];

export function getAction(id: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.id === id);
}
