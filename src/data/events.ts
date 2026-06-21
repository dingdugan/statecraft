// Data-driven events. Each is gated by `condition(state)`; the engine weight-samples
// one eligible event per turn. Options carry the tradeoffs. A choice may schedule a
// follow-up via s.chainQueue (multi-turn chains). See docs/design-engine.md §8.

import type { GameState } from '../engine/types';
import type { StepContext } from '../engine/context';
import { clamp, hasTrait } from '../engine/util';
import { figureByTitle } from './characters';

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

/** Schedule a chained follow-up event `turns` years from now (deduped). */
function chain(s: GameState, eventId: string, turns: number): void {
  if (!s.chainQueue.some((c) => c.eventId === eventId)) s.chainQueue.push({ eventId, turnsLeft: turns });
}
/** A random other country this state has relations with (or null). */
function randomRel(s: GameState, ctx: StepContext): string | null {
  const ids = Object.keys(s.relations);
  return ids.length ? ids[Math.floor(ctx.rng.next() * ids.length)] : null;
}

export const EVENTS: EventDef[] = [
  // ─── economy ─────────────────────────────────────────────────────────────────
  {
    id: 'oil_shock', title: 'Oil Price Spike', titleZh: '油价飙升',
    desc: 'Global oil prices surge. As an exporter, the windfall is yours to use.',
    descZh: '国际油价暴涨。作为出口国，这笔横财任你支配。',
    weight: 3, condition: (s) => hasTrait(s, 'oil_exporter'),
    options: [
      { label: 'Spend the windfall now', labelZh: '顺势增加开支',
        apply: (s) => { s.reserves += 0.04 * s.gdp; s.inflation = clamp(s.inflation + 0.01, -0.05, 0.4); s.approval = clamp(s.approval + 4, 0, 100); } },
      { label: 'Bank it in the sovereign fund', labelZh: '存入主权基金',
        apply: (s) => { s.reserves += 0.06 * s.gdp; s.creditRating = clamp(s.creditRating + 1, 0, 20); } },
    ],
  },
  {
    id: 'recession', title: 'Global Recession', titleZh: '全球衰退',
    desc: 'A worldwide downturn hits demand this year.', descZh: '全球性衰退今年冲击了需求。',
    weight: 2, condition: (s) => s.turn > 0,
    options: [
      { label: 'Stimulate (cushion the downturn)', labelZh: '财政刺激（缓冲衰退）',
        apply: (s) => { s.gdp *= 0.99; s.unemployment = clamp(s.unemployment + 0.015, 0.01, 0.45); s.approval = clamp(s.approval + 1, 0, 100); } },
      { label: 'Hold the line (protect the books)', labelZh: '稳住财政（守住账本）',
        apply: (s) => { s.gdp *= 0.97; s.unemployment = clamp(s.unemployment + 0.04, 0.01, 0.45); s.creditRating = clamp(s.creditRating + 1, 0, 20); s.approval = clamp(s.approval - 3, 0, 100); } },
    ],
  },
  {
    id: 'banking_crisis', title: 'Banking Crisis', titleZh: '银行业危机',
    desc: 'A major bank is on the brink. A collapse could cascade.',
    descZh: '一家大型银行濒临倒闭，放任不管恐引发连锁挤兑。',
    weight: 3, condition: (s) => s.turn > 2,
    options: [
      { label: 'Bail it out', labelZh: '注资救助',
        apply: (s) => { s.reserves -= 0.04 * s.gdp; s.debtPctGdp += 0.03; s.approval = clamp(s.approval - 3, 0, 100); chain(s, 'bailout_aftermath', 1); } },
      { label: 'Let it fail', labelZh: '任其倒闭',
        apply: (s) => { s.gdp *= 0.96; s.unemployment = clamp(s.unemployment + 0.03, 0.01, 0.45); s.unrest = clamp(s.unrest + 10, 0, 100); s.creditRating = clamp(s.creditRating + 1, 0, 20); } },
    ],
  },
  {
    id: 'housing_bubble', title: 'Housing Bubble', titleZh: '房地产泡沫',
    desc: 'Property prices are detached from reality. Cool it, or ride it?',
    descZh: '房价已严重脱离基本面。是给它降温，还是顺势而为？',
    weight: 2, condition: (s) => s.gdpGrowthReal > 0.03,
    options: [
      { label: 'Tighten credit', labelZh: '收紧信贷',
        apply: (s) => { s.gdp *= 0.99; s.inflation = clamp(s.inflation - 0.01, -0.05, 0.4); s.approval = clamp(s.approval - 2, 0, 100); s.creditRating = clamp(s.creditRating + 1, 0, 20); } },
      { label: 'Keep the party going', labelZh: '继续狂欢',
        apply: (s) => { s.gdp *= 1.01; s.inflation = clamp(s.inflation + 0.015, -0.05, 0.4); s.inequality = clamp(s.inequality + 0.01, 0.2, 0.7); } },
    ],
  },
  {
    id: 'currency_run', title: 'Currency Run', titleZh: '货币挤兑',
    desc: 'Capital is fleeing and the currency is under attack.',
    descZh: '资本外逃，本币遭到狙击。',
    weight: 3, condition: (s) => s.sanctionPressure > 25 || s.reserves < 0.05 * s.gdp,
    options: [
      { label: 'Burn reserves to defend it', labelZh: '动用储备护盘',
        apply: (s) => { s.reserves -= 0.05 * s.gdp; s.inflation = clamp(s.inflation - 0.005, -0.05, 0.4); } },
      { label: 'Let it float', labelZh: '让汇率自由浮动',
        apply: (s) => { s.inflation = clamp(s.inflation + 0.03, -0.05, 0.4); s.tradeBalance = clamp(s.tradeBalance + 0.02, -0.1, 0.12); s.approval = clamp(s.approval - 4, 0, 100); } },
    ],
  },
  {
    id: 'foreign_investment', title: 'Foreign Investment Wave', titleZh: '外资涌入',
    desc: 'Global capital wants in. On whose terms?',
    descZh: '国际资本争相进入。按谁的条件来？',
    weight: 2, condition: (s) => s.globalStanding > 58,
    options: [
      { label: 'Open the gates', labelZh: '敞开大门',
        apply: (s) => { s.gdp *= 1.015; s.productivity = clamp(s.productivity + 0.02, 0.3, 3); s.inequality = clamp(s.inequality + 0.01, 0.2, 0.7); } },
      { label: 'Screen for strategic sectors', labelZh: '筛选战略产业',
        apply: (s) => { s.gdp *= 1.005; s.militaryStrength = clamp(s.militaryStrength + 1, 0, 100); s.approval = clamp(s.approval + 2, 0, 100); } },
    ],
  },
  {
    id: 'labor_strike', title: 'General Strike', titleZh: '全国大罢工',
    desc: 'Unions have walked out. The economy is grinding to a halt.',
    descZh: '工会集体罢工，经济陷入停摆。',
    weight: 3, condition: (s) => s.unemployment > 0.08,
    options: [
      { label: 'Meet their demands', labelZh: '满足诉求',
        apply: (s) => { s.reserves -= 0.015 * s.gdp; s.approval = clamp(s.approval + 5, 0, 100); s.unrest = clamp(s.unrest - 10, 0, 100); } },
      { label: 'Break the strike', labelZh: '强力复工',
        apply: (s) => { s.gdp *= 0.99; s.unrest = clamp(s.unrest + 12, 0, 100); s.stability = clamp(s.stability - 3, 0, 100); } },
    ],
  },
  // ─── chained follow-ups (condition false → only fire via chainQueue) ──────────
  {
    id: 'bailout_aftermath', title: 'Bailout Aftermath', titleZh: '救助余波',
    desc: 'The rescued bank is stabilized. The public wants accountability.',
    descZh: '获救的银行已稳住，但公众要求追责。',
    weight: 1, condition: () => false,
    options: [
      { label: 'Impose tough new regulation', labelZh: '推行严格新监管',
        apply: (s) => { s.creditRating = clamp(s.creditRating + 1, 0, 20); s.approval = clamp(s.approval + 3, 0, 100); s.gdp *= 0.997; } },
      { label: 'Quietly move on', labelZh: '低调翻篇',
        apply: (s) => { s.debtPctGdp += 0.02; s.legitimacy = clamp(s.legitimacy - 3, 0, 100); s.unrest = clamp(s.unrest + 5, 0, 100); } },
    ],
  },
  {
    id: 'investigation_result', title: 'Investigation Results', titleZh: '调查结果',
    desc: 'The anti-corruption probe has concluded. Names are on the desk.',
    descZh: '反腐调查已结案，一份名单摆在你案头。',
    weight: 1, condition: () => false,
    options: [
      { label: 'Prosecute openly', labelZh: '公开问责',
        apply: (s) => { s.approval = clamp(s.approval + 6, 0, 100); s.legitimacy = clamp(s.legitimacy + 4, 0, 100); s.stability = clamp(s.stability - 3, 0, 100); } },
      { label: 'Bury the findings', labelZh: '大事化小',
        apply: (s) => { s.legitimacy = clamp(s.legitimacy - 6, 0, 100); s.unrest = clamp(s.unrest + 8, 0, 100); } },
    ],
  },
  // ─── politics ────────────────────────────────────────────────────────────────
  {
    id: 'mass_protests', title: 'Mass Protests', titleZh: '大规模抗议',
    desc: 'Crowds fill the streets. The state must respond.', descZh: '人群涌上街头。政府必须回应。',
    weight: 4, condition: (s) => s.unrest > 45,
    options: [
      { label: 'Crack down', labelZh: '强力镇压',
        apply: (s) => { s.unrest = clamp(s.unrest - 25, 0, 100); s.approval = clamp(s.approval - 8, 0, 100); s.stability = clamp(s.stability + 2, 0, 100); } },
      { label: 'Offer concessions', labelZh: '让步与安抚',
        apply: (s) => { s.approval = clamp(s.approval + 8, 0, 100); s.unrest = clamp(s.unrest - 15, 0, 100); s.reserves -= 0.01 * s.gdp; } },
    ],
  },
  {
    id: 'corruption_scandal', title: 'Corruption Scandal', titleZh: '腐败丑闻',
    desc: 'A scandal reaches into your cabinet. The press is circling.',
    descZh: '一桩丑闻牵连到你的内阁，媒体闻风而动。',
    weight: 3, condition: (s) => s.turn > 1,
    options: [
      { label: 'Launch a full investigation', labelZh: '彻查到底',
        apply: (s, ctx) => { s.approval = clamp(s.approval + 2, 0, 100); s.stability = clamp(s.stability - 2, 0, 100); chain(s, 'investigation_result', 1); const opp = figureByTitle(s, '反对党领袖'); if (opp) { opp.loyalty = clamp(opp.loyalty + 8, -100, 100); ctx.log.push({ kind: 'politics', msg: `反对党领袖 ${opp.nameZh} 认可你的反腐决心` }); } const mag = figureByTitle(s, '财政巨头'); if (mag) mag.loyalty = clamp(mag.loyalty - 10, -100, 100); } },
      { label: 'Suppress it', labelZh: '压下消息',
        apply: (s, ctx) => { s.unrest = clamp(s.unrest + 8, 0, 100); s.legitimacy = clamp(s.legitimacy - 4, 0, 100); const opp = figureByTitle(s, '反对党领袖'); if (opp) { opp.loyalty = clamp(opp.loyalty - 10, -100, 100); ctx.log.push({ kind: 'politics', msg: `反对党领袖 ${opp.nameZh} 痛斥你掩盖丑闻` }); } } },
    ],
  },
  {
    id: 'coalition_crisis', title: 'Coalition Crisis', titleZh: '联合政府危机',
    desc: 'A partner threatens to bolt. Your majority is at risk.',
    descZh: '执政伙伴扬言退出，你的多数地位岌岌可危。',
    weight: 3, condition: (s) => s.govType === 'democracy' && s.approval < 46,
    options: [
      { label: 'Cut a deal to hold it together', labelZh: '让利保住联盟',
        apply: (s) => { s.reserves -= 0.012 * s.gdp; s.stability = clamp(s.stability + 4, 0, 100); } },
      { label: 'Call their bluff', labelZh: '强硬对赌',
        apply: (s) => { s.stability = clamp(s.stability - 6, 0, 100); s.approval = clamp(s.approval + 3, 0, 100); } },
    ],
  },
  {
    id: 'succession_question', title: 'Succession Question', titleZh: '接班难题',
    desc: 'Elites are jockeying over who comes next. Uncertainty breeds risk.',
    descZh: '权力核心为接班问题暗中角力，不确定性滋生风险。',
    weight: 2, condition: (s) => s.govType !== 'democracy' && s.turn > 2,
    options: [
      { label: 'Anoint a clear successor', labelZh: '明确指定接班人',
        apply: (s) => { s.stability = clamp(s.stability + 5, 0, 100); s.coupRisk = clamp(s.coupRisk - 4, 0, 100); s.legitimacy = clamp(s.legitimacy - 2, 0, 100); } },
      { label: 'Keep everyone guessing', labelZh: '让各方猜忌制衡',
        apply: (s) => { s.coupRisk = clamp(s.coupRisk + 5, 0, 100); s.approval = clamp(s.approval + 2, 0, 100); } },
    ],
  },
  {
    id: 'referendum', title: 'Referendum Demand', titleZh: '公投诉求',
    desc: 'A movement demands a national vote on a divisive issue.',
    descZh: '一场运动要求就争议议题举行全民公投。',
    weight: 2, condition: (s) => s.govType === 'democracy' && s.turn > 2,
    options: [
      { label: 'Hold the referendum', labelZh: '举行公投',
        apply: (s) => { s.legitimacy = clamp(s.legitimacy + 5, 0, 100); s.unrest = clamp(s.unrest - 6, 0, 100); s.stability = clamp(s.stability - 3, 0, 100); } },
      { label: 'Refuse', labelZh: '拒绝公投',
        apply: (s) => { s.unrest = clamp(s.unrest + 8, 0, 100); s.approval = clamp(s.approval - 3, 0, 100); } },
    ],
  },
  {
    id: 'press_freedom', title: 'Press Freedom Clash', titleZh: '新闻自由争议',
    desc: 'A critical outlet has crossed a line, the state says. Or has it?',
    descZh: '当局称一家批评性媒体越了线。真是如此吗？',
    weight: 2, condition: (s) => s.turn > 1,
    options: [
      { label: 'Defend a free press', labelZh: '捍卫新闻自由',
        apply: (s) => { s.legitimacy = clamp(s.legitimacy + 4, 0, 100); s.globalStanding = clamp(s.globalStanding + 2, 0, 100); s.approval = clamp(s.approval - 2, 0, 100); } },
      { label: 'Rein it in', labelZh: '加强管控',
        apply: (s) => { s.stability = clamp(s.stability + 3, 0, 100); s.legitimacy = clamp(s.legitimacy - 5, 0, 100); s.globalStanding = clamp(s.globalStanding - 3, 0, 100); } },
    ],
  },
  // ─── diplomacy ───────────────────────────────────────────────────────────────
  {
    id: 'trade_dispute', title: 'Trade Dispute', titleZh: '贸易争端',
    desc: 'A major partner slaps tariffs on your exports.', descZh: '一个主要贸易伙伴对你的出口加征关税。',
    weight: 2, condition: (s) => s.turn > 1 && Object.keys(s.relations).length > 0,
    options: [
      { label: 'Retaliate', labelZh: '强硬反制',
        apply: (s, ctx) => { const t = randomRel(s, ctx); if (t) s.relations[t] = clamp((s.relations[t] ?? 0) - 22, -100, 100); s.approval = clamp(s.approval + 3, 0, 100); } },
      { label: 'Negotiate a deal', labelZh: '谈判让步',
        apply: (s, ctx) => { const t = randomRel(s, ctx); if (t) s.relations[t] = clamp((s.relations[t] ?? 0) + 6, -100, 100); s.approval = clamp(s.approval - 2, 0, 100); } },
    ],
  },
  {
    id: 'alliance_offer', title: 'Alliance Offer', titleZh: '结盟邀约',
    desc: 'A friendly power proposes a formal alliance.',
    descZh: '一个友好大国提议结成正式同盟。',
    weight: 2, condition: (s) => Object.values(s.relations).some((r) => r > 30),
    options: [
      { label: 'Sign the pact', labelZh: '签署盟约',
        apply: (s, ctx) => { const ids = Object.keys(s.relations).filter((i) => (s.relations[i] ?? 0) > 30); const t = ids[Math.floor(ctx.rng.next() * ids.length)]; if (t) s.relations[t] = clamp((s.relations[t] ?? 0) + 20, -100, 100); s.militaryReadiness = clamp(s.militaryReadiness + 3, 0, 100); s.globalStanding = clamp(s.globalStanding + 3, 0, 100); } },
      { label: 'Stay non-aligned', labelZh: '保持不结盟',
        apply: (s) => { s.globalStanding = clamp(s.globalStanding + 1, 0, 100); s.approval = clamp(s.approval + 1, 0, 100); } },
    ],
  },
  {
    id: 'border_incident', title: 'Border Incident', titleZh: '边境摩擦',
    desc: 'Shots were exchanged at a contested border. Tensions spike.',
    descZh: '争议边境发生交火，局势骤然紧张。',
    weight: 3, condition: (s) => Object.values(s.relations).some((r) => r < -25),
    options: [
      { label: 'De-escalate', labelZh: '降温处理',
        apply: (s, ctx) => { const ids = Object.keys(s.relations).filter((i) => (s.relations[i] ?? 0) < -25); const t = ids[Math.floor(ctx.rng.next() * ids.length)]; if (t) s.relations[t] = clamp((s.relations[t] ?? 0) + 10, -100, 100); s.approval = clamp(s.approval - 2, 0, 100); } },
      { label: 'Mobilize in response', labelZh: '强硬动员',
        apply: (s, ctx) => { const ids = Object.keys(s.relations).filter((i) => (s.relations[i] ?? 0) < -25); const t = ids[Math.floor(ctx.rng.next() * ids.length)]; if (t) s.relations[t] = clamp((s.relations[t] ?? 0) - 14, -100, 100); s.militaryReadiness = clamp(s.militaryReadiness + 5, 0, 100); s.reserves -= 0.01 * s.gdp; } },
    ],
  },
  {
    id: 'spy_scandal', title: 'Espionage Scandal', titleZh: '间谍丑闻',
    desc: "A foreign agent has been caught inside your ministries.",
    descZh: '你的部委内部抓到了一名外国间谍。',
    weight: 2, condition: (s) => Object.values(s.relations).some((r) => r < 0),
    options: [
      { label: 'Expel diplomats publicly', labelZh: '公开驱逐外交官',
        apply: (s, ctx) => { const t = randomRel(s, ctx); if (t) s.relations[t] = clamp((s.relations[t] ?? 0) - 16, -100, 100); s.approval = clamp(s.approval + 3, 0, 100); } },
      { label: 'Handle it quietly', labelZh: '私下处理',
        apply: (s) => { s.legitimacy = clamp(s.legitimacy + 1, 0, 100); s.globalStanding = clamp(s.globalStanding + 1, 0, 100); } },
    ],
  },
  {
    id: 'refugee_influx', title: 'Refugee Influx', titleZh: '难民潮',
    desc: 'A regional crisis sends refugees to your borders.',
    descZh: '一场地区危机将难民推向你的边境。',
    weight: 2, condition: (s) => s.turn > 2,
    options: [
      { label: 'Open the borders', labelZh: '开放接收',
        apply: (s) => { s.reserves -= 0.015 * s.gdp; s.globalStanding = clamp(s.globalStanding + 3, 0, 100); s.unrest = clamp(s.unrest + 5, 0, 100); s.laborParticipation = clamp(s.laborParticipation + 0.005, 0.4, 0.75); } },
      { label: 'Seal the borders', labelZh: '封锁边境',
        apply: (s) => { s.globalStanding = clamp(s.globalStanding - 3, 0, 100); s.approval = clamp(s.approval + 3, 0, 100); } },
    ],
  },
  // ─── disaster / environment ──────────────────────────────────────────────────
  {
    id: 'natural_disaster', title: 'Natural Disaster', titleZh: '自然灾害',
    desc: 'A major disaster strikes. Relief costs money; neglect costs trust.',
    descZh: '一场大灾降临。救灾要花钱，怠慢则失民心。',
    weight: 2, condition: (s) => s.turn > 0,
    options: [
      { label: 'Fund a full relief effort', labelZh: '全力救灾',
        apply: (s) => { s.reserves -= 0.03 * s.gdp; s.approval = clamp(s.approval + 4, 0, 100); } },
      { label: 'Minimal response', labelZh: '最低限度应对',
        apply: (s) => { s.reserves -= 0.005 * s.gdp; s.approval = clamp(s.approval - 6, 0, 100); s.unrest = clamp(s.unrest + 8, 0, 100); } },
    ],
  },
  {
    id: 'climate_flood', title: 'Catastrophic Flood', titleZh: '特大洪灾',
    desc: 'Record rainfall has inundated your heartland.',
    descZh: '创纪录的暴雨淹没了你的腹地。',
    weight: 2, condition: (s) => s.climateStress > 28,
    options: [
      { label: 'Invest in resilient rebuilding', labelZh: '韧性重建',
        apply: (s) => { s.reserves -= 0.025 * s.gdp; s.climateStress = clamp(s.climateStress - 6, 0, 100); s.approval = clamp(s.approval + 3, 0, 100); } },
      { label: 'Rebuild cheaply', labelZh: '低成本重建',
        apply: (s) => { s.reserves -= 0.008 * s.gdp; s.climateStress = clamp(s.climateStress + 3, 0, 100); } },
    ],
  },
  {
    id: 'drought', title: 'Severe Drought', titleZh: '严重干旱',
    desc: 'Crops are failing across the farm belt.',
    descZh: '农业带大面积歉收。',
    weight: 2, condition: (s) => s.turn > 0,
    options: [
      { label: 'Subsidize farmers + import food', labelZh: '补贴农户、进口粮食',
        apply: (s) => { s.reserves -= 0.02 * s.gdp; s.inflation = clamp(s.inflation + 0.005, -0.05, 0.4); s.approval = clamp(s.approval + 2, 0, 100); } },
      { label: 'Let the market adjust', labelZh: '交给市场调节',
        apply: (s) => { s.inflation = clamp(s.inflation + 0.02, -0.05, 0.4); s.unrest = clamp(s.unrest + 6, 0, 100); } },
    ],
  },
  {
    id: 'industrial_accident', title: 'Industrial Disaster', titleZh: '重大工业事故',
    desc: 'A catastrophic plant failure has killed workers and poisoned a region.',
    descZh: '一场灾难性的工厂事故造成伤亡并污染了一片区域。',
    weight: 2, condition: (s) => s.sectors.industry > 0.25,
    options: [
      { label: 'Tighten safety + compensate', labelZh: '严管安全、全额赔偿',
        apply: (s) => { s.reserves -= 0.015 * s.gdp; s.gdp *= 0.997; s.approval = clamp(s.approval + 3, 0, 100); s.emissions = clamp(s.emissions - 2, 0, 200); } },
      { label: 'Downplay it', labelZh: '淡化处理',
        apply: (s) => { s.unrest = clamp(s.unrest + 9, 0, 100); s.legitimacy = clamp(s.legitimacy - 4, 0, 100); } },
    ],
  },
  {
    id: 'cyber_attack', title: 'Cyber Attack', titleZh: '网络攻击',
    desc: 'State infrastructure is under a sophisticated cyber assault.',
    descZh: '国家基础设施遭到一场精密的网络攻击。',
    weight: 2, condition: (s) => s.techLevel > 1.1 || hasTrait(s, 'tech_hub'),
    options: [
      { label: 'Invest in cyber defense', labelZh: '加大网络防御投入',
        apply: (s) => { s.reserves -= 0.012 * s.gdp; s.militaryStrength = clamp(s.militaryStrength + 2, 0, 100); s.techLevel = clamp(s.techLevel + 0.02, 0.5, 5); } },
      { label: 'Absorb the hit', labelZh: '硬扛损失',
        apply: (s) => { s.gdp *= 0.99; s.globalStanding = clamp(s.globalStanding - 2, 0, 100); } },
    ],
  },
  // ─── society ─────────────────────────────────────────────────────────────────
  {
    id: 'demographic_alarm', title: 'Demographic Alarm', titleZh: '人口警报',
    desc: 'Demographers warn an aging population will crush future budgets.',
    descZh: '人口学家警告：老龄化将压垮未来的财政。',
    weight: 2, oncePerGame: true, condition: (s) => s.medianAge > 46,
    options: [
      { label: 'Pension reform now', labelZh: '立即养老金改革',
        apply: (s) => { s.approval = clamp(s.approval - 5, 0, 100); s.stability = clamp(s.stability - 2, 0, 100); s.creditRating = clamp(s.creditRating + 1, 0, 20); } },
      { label: 'Kick it down the road', labelZh: '拖到以后再说',
        apply: (s) => { s.debtPctGdp += 0.05; s.approval = clamp(s.approval + 2, 0, 100); } },
    ],
  },
  {
    id: 'baby_boom', title: 'Baby Boom', titleZh: '婴儿潮',
    desc: 'Birth rates are surging. A future workforce, at a present cost.',
    descZh: '出生率激增——未来的劳动力，眼下的开销。',
    weight: 2, condition: (s) => s.medianAge < 36,
    options: [
      { label: 'Fund childcare + schools', labelZh: '投入托育与教育',
        apply: (s) => { s.reserves -= 0.015 * s.gdp; s.educationLevel = clamp(s.educationLevel + 1, 0, 100); s.popGrowth = clamp(s.popGrowth + 0.001, -0.02, 0.05); s.approval = clamp(s.approval + 3, 0, 100); } },
      { label: 'Leave it to families', labelZh: '交给家庭',
        apply: (s) => { s.inequality = clamp(s.inequality + 0.01, 0.2, 0.7); } },
    ],
  },
  {
    id: 'brain_drain', title: 'Brain Drain', titleZh: '人才流失',
    desc: 'Your best minds are emigrating for opportunity abroad.',
    descZh: '你最优秀的人才正为海外机会而出走。',
    weight: 2, condition: (s) => s.unemployment > 0.1 && s.educationLevel > 65,
    options: [
      { label: 'Court them home with incentives', labelZh: '以政策吸引回流',
        apply: (s) => { s.reserves -= 0.012 * s.gdp; s.productivity = clamp(s.productivity + 0.02, 0.3, 3); s.educationLevel = clamp(s.educationLevel + 1, 0, 100); } },
      { label: 'Let them go', labelZh: '听之任之',
        apply: (s) => { s.productivity = clamp(s.productivity - 0.02, 0.3, 3); s.tradeBalance = clamp(s.tradeBalance + 0.005, -0.1, 0.12); } },
    ],
  },
  {
    id: 'healthcare_crisis', title: 'Healthcare Crisis', titleZh: '医疗危机',
    desc: 'Hospitals are overwhelmed and the public is frightened.',
    descZh: '医院不堪重负，民众惶恐不安。',
    weight: 3, condition: (s) => s.healthIndex < 64,
    options: [
      { label: 'Emergency health funding', labelZh: '紧急医疗拨款',
        apply: (s) => { s.reserves -= 0.02 * s.gdp; s.healthIndex = clamp(s.healthIndex + 6, 0, 100); s.approval = clamp(s.approval + 4, 0, 100); } },
      { label: 'Ration care', labelZh: '配给式医疗',
        apply: (s) => { s.healthIndex = clamp(s.healthIndex - 3, 0, 100); s.unrest = clamp(s.unrest + 8, 0, 100); } },
    ],
  },
  {
    id: 'inequality_unrest', title: 'Inequality Backlash', titleZh: '不平等抗议',
    desc: 'A wealth gap has become a political flashpoint.',
    descZh: '贫富差距成了政治引爆点。',
    weight: 2, condition: (s) => s.inequality > 0.46,
    options: [
      { label: 'Redistribute', labelZh: '推动再分配',
        apply: (s) => { s.inequality = clamp(s.inequality - 0.03, 0.2, 0.7); s.reserves -= 0.012 * s.gdp; s.approval = clamp(s.approval + 4, 0, 100); } },
      { label: 'Defend the status quo', labelZh: '维持现状',
        apply: (s) => { s.unrest = clamp(s.unrest + 10, 0, 100); s.inequality = clamp(s.inequality + 0.01, 0.2, 0.7); } },
    ],
  },
  // ─── technology ──────────────────────────────────────────────────────────────
  {
    id: 'tech_boom', title: 'Technology Boom', titleZh: '科技繁荣',
    desc: 'A wave of innovation is cresting. Will you ride it?',
    descZh: '一波创新浪潮正在涌起。你要顺势而为吗？',
    weight: 2, condition: (s) => hasTrait(s, 'tech_hub') || s.educationLevel > 78,
    options: [
      { label: 'Invest heavily in R&D', labelZh: '重金投入研发',
        apply: (s) => { s.productivity = clamp(s.productivity + 0.05, 0.3, 3); s.gdp *= 1.02; s.reserves -= 0.01 * s.gdp; } },
      { label: 'Let the market lead', labelZh: '交给市场',
        apply: (s) => { s.gdp *= 1.01; s.reserves += 0.01 * s.gdp; s.approval = clamp(s.approval + 2, 0, 100); } },
    ],
  },
  {
    id: 'ai_breakthrough', title: 'AI Breakthrough', titleZh: 'AI 突破',
    desc: 'Your labs are at the frontier of automation. Jobs and power are at stake.',
    descZh: '你的实验室站在自动化前沿，就业与权力都悬于一线。',
    weight: 2, condition: (s) => s.techLevel > 1.2 || hasTrait(s, 'tech_hub'),
    options: [
      { label: 'Race ahead', labelZh: '全力抢跑',
        apply: (s) => { s.productivity = clamp(s.productivity + 0.06, 0.3, 3); s.techLevel = clamp(s.techLevel + 0.05, 0.5, 5); s.unemployment = clamp(s.unemployment + 0.01, 0.01, 0.45); } },
      { label: 'Regulate for jobs', labelZh: '为就业而监管',
        apply: (s) => { s.unemployment = clamp(s.unemployment - 0.005, 0.01, 0.45); s.approval = clamp(s.approval + 3, 0, 100); s.gdp *= 1.003; } },
    ],
  },
  {
    id: 'energy_transition', title: 'Energy Transition', titleZh: '能源转型',
    desc: 'Pressure mounts to green the grid. It is costly but transformative.',
    descZh: '电网绿色化的压力不断累积——代价高昂，却影响深远。',
    weight: 2, condition: (s) => s.emissions > 48,
    options: [
      { label: 'Go big on clean energy', labelZh: '大举投资清洁能源',
        apply: (s) => { s.reserves -= 0.025 * s.gdp; s.emissions = clamp(s.emissions - 8, 0, 200); s.climateStress = clamp(s.climateStress - 3, 0, 100); } },
      { label: 'Stick with cheap power', labelZh: '维持廉价能源',
        apply: (s) => { s.gdp *= 1.005; s.emissions = clamp(s.emissions + 4, 0, 200); s.globalStanding = clamp(s.globalStanding - 2, 0, 100); } },
    ],
  },
  // ─── military ────────────────────────────────────────────────────────────────
  {
    id: 'war_council', title: 'War Council', titleZh: '战局抉择',
    desc: 'The front is active. Your generals await orders.', descZh: '前线胶着，将领们等待你的决断。',
    weight: 5, condition: (s) => s.warWith !== null,
    options: [
      { label: 'Press the offensive', labelZh: '全力进攻',
        apply: (s) => { s.warScore = clamp(s.warScore + 15, -100, 100); s.reserves -= 0.02 * s.gdp; s.warExhaustion = clamp(s.warExhaustion + 8, 0, 100); } },
      { label: 'Hold and consolidate', labelZh: '稳守消耗',
        apply: (s) => { s.warExhaustion = clamp(s.warExhaustion - 8, 0, 100); s.approval = clamp(s.approval + 2, 0, 100); } },
    ],
  },
  {
    id: 'coup_rumor', title: 'Coup Rumors', titleZh: '政变传闻',
    desc: 'Whispers of a plot are spreading through the officer corps.',
    descZh: '军官团中流传着密谋的风声。',
    weight: 3, condition: (s) => s.coupRisk > 20,
    options: [
      { label: 'Purge suspect officers', labelZh: '清洗可疑军官',
        apply: (s, ctx) => { s.coupRisk = clamp(s.coupRisk - 10, 0, 100); s.militaryReadiness = clamp(s.militaryReadiness - 4, 0, 100); s.stability = clamp(s.stability + 2, 0, 100); const mil = figureByTitle(s, '军方统帅'); if (mil) { mil.loyalty = clamp(mil.loyalty - 15, -100, 100); ctx.log.push({ kind: 'politics', msg: `军方统帅 ${mil.nameZh} 对清洗怀恨在心` }); } } },
      { label: 'Buy their loyalty', labelZh: '收买军心',
        apply: (s, ctx) => { s.reserves -= 0.02 * s.gdp; s.coupRisk = clamp(s.coupRisk - 8, 0, 100); const mil = figureByTitle(s, '军方统帅'); if (mil) { mil.loyalty = clamp(mil.loyalty + 12, -100, 100); ctx.log.push({ kind: 'politics', msg: `军方统帅 ${mil.nameZh} 领情，军心暂稳` }); } } },
    ],
  },
  {
    id: 'arms_deal', title: 'Arms Deal', titleZh: '军购案',
    desc: 'A foreign supplier offers advanced weapons — at a price.',
    descZh: '一家外国供应商兜售先进武器——当然，价格不菲。',
    weight: 2, condition: (s) => s.militaryStrength < 62,
    options: [
      { label: 'Buy the hardware', labelZh: '购入装备',
        apply: (s) => { s.reserves -= 0.025 * s.gdp; s.militaryStrength = clamp(s.militaryStrength + 6, 0, 100); s.militaryReadiness = clamp(s.militaryReadiness + 3, 0, 100); } },
      { label: 'Invest in domestic industry instead', labelZh: '转投本土军工',
        apply: (s) => { s.reserves -= 0.015 * s.gdp; s.militaryStrength = clamp(s.militaryStrength + 2, 0, 100); s.sectors.industry = clamp(s.sectors.industry + 0.01, 0, 1); } },
    ],
  },
  {
    id: 'veterans_demand', title: 'Veterans March', titleZh: '老兵诉求',
    desc: 'Veterans are demanding the benefits they were promised.',
    descZh: '老兵们走上街头，索要当初许诺的待遇。',
    weight: 2, condition: (s) => s.warExhaustion > 5 || s.turn > 4,
    options: [
      { label: 'Honor the promises', labelZh: '兑现承诺',
        apply: (s) => { s.reserves -= 0.015 * s.gdp; s.approval = clamp(s.approval + 4, 0, 100); s.militaryReadiness = clamp(s.militaryReadiness + 2, 0, 100); } },
      { label: 'Defer the payments', labelZh: '拖延支付',
        apply: (s) => { s.unrest = clamp(s.unrest + 6, 0, 100); s.militaryReadiness = clamp(s.militaryReadiness - 3, 0, 100); } },
    ],
  },
];

export function getEvent(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

// ─── world events (v2.4): global shocks applied to every playing country ─────────
export interface WorldEventDef {
  id: string;
  kind: 'econ' | 'war' | 'diplo' | 'politics' | 'disaster';
  newsZh: string;
  weight: number;
  apply: (s: GameState) => void;
}

export const WORLD_EVENTS: WorldEventDef[] = [
  { id: 'global_pandemic', kind: 'disaster', weight: 2, newsZh: '🦠 全球大流行病爆发，各国经济与公共卫生承压',
    apply: (s) => { s.gdp *= 0.98; s.unemployment = clamp(s.unemployment + 0.02, 0.01, 0.45); s.healthIndex = clamp(s.healthIndex - 6, 0, 100); s.approval = clamp(s.approval - 3, 0, 100); } },
  { id: 'global_financial_crisis', kind: 'econ', weight: 2, newsZh: '💸 全球金融危机蔓延，信贷收紧、债务高企',
    apply: (s) => { s.gdp *= 0.97; s.debtPctGdp += 0.04; s.creditRating = clamp(s.creditRating - 1, 0, 20); s.unemployment = clamp(s.unemployment + 0.015, 0.01, 0.45); } },
  { id: 'global_tech_leap', kind: 'econ', weight: 2, newsZh: '🚀 一场全球科技跃迁普遍提升了各国生产力',
    apply: (s) => { s.productivity = clamp(s.productivity + 0.03, 0.3, 3); s.techLevel = clamp(s.techLevel + 0.04, 0.5, 5); s.gdp *= 1.01; } },
  { id: 'energy_crisis', kind: 'econ', weight: 2, newsZh: '⛽ 全球能源危机：油气价格剧烈波动',
    apply: (s) => { s.commodityPrice = clamp(s.commodityPrice + 0.2, 0.3, 3); s.inflation = clamp(s.inflation + 0.015, -0.05, 0.4); if (hasTrait(s, 'oil_exporter')) s.reserves += 0.02 * s.gdp; else s.gdp *= 0.99; } },
  { id: 'global_boom', kind: 'econ', weight: 2, newsZh: '📈 全球经济同步繁荣，贸易与投资旺盛',
    apply: (s) => { s.gdp *= 1.015; s.unemployment = clamp(s.unemployment - 0.01, 0.01, 0.45); s.approval = clamp(s.approval + 2, 0, 100); } },
  { id: 'climate_shock', kind: 'disaster', weight: 2, newsZh: '🌡️ 极端气候事件席卷多国',
    apply: (s) => { s.climateStress = clamp(s.climateStress + 8, 0, 100); s.gdp *= 0.992; s.emissions = clamp(s.emissions - 2, 0, 200); } },
];
