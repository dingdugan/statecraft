// Data-driven events. Each is gated by `condition(state)`; the engine weight-samples
// one eligible event per turn. Options carry the tradeoffs. See docs/design-engine.md §8.

import type { GameState } from '../engine/types';
import type { StepContext } from '../engine/context';
import { clamp, hasTrait } from '../engine/util';

export interface EventOption {
  label: string;
  labelZh: string;
  requires?: (s: GameState) => boolean;
  apply: (s: GameState, ctx: StepContext) => void;
}

export interface EventDef {
  id: string;
  title: string;
  titleZh: string;
  desc: string;
  descZh: string;
  weight: number;
  oncePerGame?: boolean;
  condition: (s: GameState) => boolean;
  options: EventOption[];
}

export const EVENTS: EventDef[] = [
  {
    id: 'oil_shock',
    title: 'Oil Price Spike',
    titleZh: '油价飙升',
    desc: 'Global oil prices surge. As an exporter, the windfall is yours to use.',
    descZh: '国际油价暴涨。作为出口国，这笔横财任你支配。',
    weight: 3,
    condition: (s) => hasTrait(s, 'oil_exporter'),
    options: [
      {
        label: 'Spend the windfall now',
        labelZh: '顺势增加开支',
        apply: (s) => {
          s.reserves += 0.04 * s.gdp;
          s.inflation = clamp(s.inflation + 0.01, -0.05, 0.4);
          s.approval = clamp(s.approval + 4, 0, 100);
        },
      },
      {
        label: 'Bank it in the sovereign fund',
        labelZh: '存入主权基金',
        apply: (s) => {
          s.reserves += 0.06 * s.gdp;
          s.creditRating = clamp(s.creditRating + 1, 0, 20);
        },
      },
    ],
  },
  {
    id: 'mass_protests',
    title: 'Mass Protests',
    titleZh: '大规模抗议',
    desc: 'Crowds fill the streets. The state must respond.',
    descZh: '人群涌上街头。政府必须回应。',
    weight: 4,
    condition: (s) => s.unrest > 45,
    options: [
      {
        label: 'Crack down',
        labelZh: '强力镇压',
        apply: (s) => {
          s.unrest = clamp(s.unrest - 25, 0, 100);
          s.approval = clamp(s.approval - 8, 0, 100);
          s.stability = clamp(s.stability + 2, 0, 100);
        },
      },
      {
        label: 'Offer concessions',
        labelZh: '让步与安抚',
        apply: (s) => {
          s.approval = clamp(s.approval + 8, 0, 100);
          s.unrest = clamp(s.unrest - 15, 0, 100);
          s.reserves -= 0.01 * s.gdp; // one-time fiscal cost, not a permanent lever change
        },
      },
    ],
  },
  {
    id: 'recession',
    title: 'Global Recession',
    titleZh: '全球衰退',
    desc: 'A worldwide downturn hits demand this year.',
    descZh: '全球性衰退今年冲击了需求。',
    weight: 2,
    condition: (s) => s.turn > 0,
    options: [
      {
        label: 'Stimulate (cushion the downturn)',
        labelZh: '财政刺激（缓冲衰退）',
        apply: (s) => {
          // one-time cushion; the player owns the spending lever, events don't ratchet it
          s.gdp *= 0.99;
          s.unemployment = clamp(s.unemployment + 0.015, 0.01, 0.45);
          s.approval = clamp(s.approval + 1, 0, 100);
        },
      },
      {
        label: 'Hold the line (protect the books)',
        labelZh: '稳住财政（守住账本）',
        apply: (s) => {
          s.gdp *= 0.97;
          s.unemployment = clamp(s.unemployment + 0.04, 0.01, 0.45);
          s.creditRating = clamp(s.creditRating + 1, 0, 20);
          s.approval = clamp(s.approval - 3, 0, 100);
        },
      },
    ],
  },
  {
    id: 'tech_boom',
    title: 'Technology Boom',
    titleZh: '科技繁荣',
    desc: 'A wave of innovation is cresting. Will you ride it?',
    descZh: '一波创新浪潮正在涌起。你要顺势而为吗？',
    weight: 2,
    condition: (s) => hasTrait(s, 'tech_hub') || s.educationLevel > 78,
    options: [
      {
        label: 'Invest heavily in R&D',
        labelZh: '重金投入研发',
        apply: (s) => {
          s.productivity = clamp(s.productivity + 0.05, 0.3, 3);
          s.gdp *= 1.02;
          s.reserves -= 0.01 * s.gdp;
        },
      },
      {
        label: 'Let the market lead',
        labelZh: '交给市场',
        apply: (s) => {
          s.gdp *= 1.01;
          s.reserves += 0.01 * s.gdp;
          s.approval = clamp(s.approval + 2, 0, 100);
        },
      },
    ],
  },
  {
    id: 'natural_disaster',
    title: 'Natural Disaster',
    titleZh: '自然灾害',
    desc: 'A major disaster strikes. Relief costs money; neglect costs trust.',
    descZh: '一场大灾降临。救灾要花钱，怠慢则失民心。',
    weight: 2,
    condition: (s) => s.turn > 0,
    options: [
      {
        label: 'Fund a full relief effort',
        labelZh: '全力救灾',
        apply: (s) => {
          s.reserves -= 0.03 * s.gdp;
          s.approval = clamp(s.approval + 4, 0, 100);
        },
      },
      {
        label: 'Minimal response',
        labelZh: '最低限度应对',
        apply: (s) => {
          s.reserves -= 0.005 * s.gdp;
          s.approval = clamp(s.approval - 6, 0, 100);
          s.unrest = clamp(s.unrest + 8, 0, 100);
        },
      },
    ],
  },
  {
    id: 'demographic_alarm',
    title: 'Demographic Alarm',
    titleZh: '人口警报',
    desc: 'Demographers warn an aging population will crush future budgets.',
    descZh: '人口学家警告：老龄化将压垮未来的财政。',
    weight: 2,
    oncePerGame: true,
    condition: (s) => s.medianAge > 46,
    options: [
      {
        label: 'Pension reform now',
        labelZh: '立即养老金改革',
        apply: (s) => {
          s.approval = clamp(s.approval - 5, 0, 100);
          s.stability = clamp(s.stability - 2, 0, 100);
          s.creditRating = clamp(s.creditRating + 1, 0, 20);
        },
      },
      {
        label: 'Kick it down the road',
        labelZh: '拖到以后再说',
        apply: (s) => {
          s.debtPctGdp += 0.05;
          s.approval = clamp(s.approval + 2, 0, 100);
        },
      },
    ],
  },
  {
    id: 'trade_dispute',
    title: 'Trade Dispute',
    titleZh: '贸易争端',
    desc: 'A major partner slaps tariffs on your exports.',
    descZh: '一个主要贸易伙伴对你的出口加征关税。',
    weight: 2,
    condition: (s) => s.turn > 1 && Object.keys(s.relations).length > 0,
    options: [
      {
        label: 'Retaliate',
        labelZh: '强硬反制',
        apply: (s, ctx) => {
          const ids = Object.keys(s.relations);
          const t = ids[Math.floor(ctx.rng.next() * ids.length)];
          s.relations[t] = clamp((s.relations[t] ?? 0) - 22, -100, 100);
          s.approval = clamp(s.approval + 3, 0, 100);
        },
      },
      {
        label: 'Negotiate a deal',
        labelZh: '谈判让步',
        apply: (s, ctx) => {
          const ids = Object.keys(s.relations);
          const t = ids[Math.floor(ctx.rng.next() * ids.length)];
          s.relations[t] = clamp((s.relations[t] ?? 0) + 6, -100, 100);
          s.approval = clamp(s.approval - 2, 0, 100);
        },
      },
    ],
  },
];

export function getEvent(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
