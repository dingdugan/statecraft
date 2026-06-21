// Core type contracts for the simulation engine. See docs/design-engine.md §1.

export type GovType = 'democracy' | 'authoritarian' | 'monarchy' | 'hybrid';
export type Status =
  | 'playing' | 'bankrupt' | 'revolution' | 'coup' | 'defeated' | 'voted_out' | 'ended' | 'victory';
export type Sector = 'agriculture' | 'industry' | 'services';
export type SpendCategory =
  | 'military' | 'education' | 'healthcare' | 'infrastructure' | 'welfare' | 'rnd';

export interface RngState {
  seed: number;
  cursor: number;
}

export type Allocation = Record<SpendCategory, number>;

export type LogKind = 'econ' | 'fiscal' | 'politics' | 'event' | 'fail' | 'info';
export interface LogEntry {
  kind: LogKind;
  msg: string;
}

/** A milestone recorded in the running chronicle (narrative layer, v2.6). */
export interface ChronicleEntry {
  year: number;
  text: string;
  id: string; // unique milestone id; one entry per id per game
}

/** The complete, serializable game state. The RNG lives inside it, so a JSON
 *  round-trip is bit-identical — that is how save/reload determinism is guaranteed. */
export interface GameState {
  // meta
  countryId: string;
  govType: GovType;
  traits: string[];
  trendGrowth: number; // baseline real growth, copied from the country def
  year: number;
  turn: number;
  rng: RngState;
  status: Status;
  endReason?: string;

  // economy
  gdp: number; // nominal, USD billions
  gdpGrowthReal: number; // last realized real growth (fraction)
  sectors: Record<Sector, number>; // shares, sum = 1
  productivity: number; // index, 1.00 = baseline (tracks techLevel)
  techLevel: number; // tech index 0.5..3, driven by R&D; feeds growth + productivity
  unemployment: number; // fraction [0.01, 0.45]
  inflation: number; // fraction [-0.05, 0.40]
  priceLevel: number; // cumulative price level (1.0 = baseline year); deflates nominal GDP

  // population
  population: number; // millions
  popGrowth: number; // fraction (may be negative)
  medianAge: number;
  laborParticipation: number;
  educationLevel: number; // index 0..100

  // social
  inequality: number; // Gini, ~0.20..0.70
  healthIndex: number; // 0..100
  qualityOfLife: number; // 0..100 (derived)
  legitimacy: number; // 0..100 (derived)

  // government / politics
  approval: number; // 0..100
  stability: number; // 0..100
  unrest: number; // 0..100 accumulator
  termYearsLeft: number; // democracies only
  lowStabilityStreak: number; // consecutive turns at stability <= 5
  politicalCapital: number; // 0..30, spent on active actions; accrues from approval + stability

  // military
  militaryStrength: number; // 0..100 index (funding + tech + manpower)
  militaryReadiness: number; // 0..100 (current funding adequacy)
  coupRisk: number; // 0..100 (derived)

  // diplomacy & trade
  relations: Record<string, number>; // relation -100..100 with each other country id
  globalStanding: number; // 0..100 soft power / standing
  tradeBalance: number; // net trade as fraction of GDP
  sanctionPressure: number; // 0..100 (derived from hostile relations)

  // war
  warWith: string | null; // country id at war with, or null (peace)
  warScore: number; // -100..100 (positive = winning)
  warExhaustion: number; // 0..100

  // resources & environment
  commodityPrice: number; // global commodity/oil price index ~0.4..2.2 (1.0 baseline)
  resourceDepletion: number; // 0..100 (rises as resource economies extract)
  resourceIncome: number; // fraction of GDP from commodity exports (derived)
  emissions: number; // 0..100 annual emissions intensity (derived)
  climateStress: number; // 0..100 cumulative climate damage (drags growth + QoL)

  // fiscal — player levers: taxRate, spendingPctGdp, allocation
  taxRate: number; // target revenue as fraction of GDP [0.10, 0.60]
  spendingPctGdp: number; // primary spending envelope, fraction of GDP [0.10, 0.70]
  allocation: Allocation;
  debtPctGdp: number; // govt debt / GDP (fraction)
  creditRating: number; // 0..20 (20 = AAA)
  deficitPctGdp: number; // last realized total deficit / GDP
  reserves: number; // USD billions
  marketAccessLostYears: number;

  // scoring
  prosperity: number; // 0..100 (derived each turn)
  score: number; // 0..100 composite
  victoryStreak: number; // consecutive years at score >= 85 (for SUPERPOWER victory)
  mandateId: string; // the player's tenure objective (a goal lens, not simulated state)
  activeCrisis: { id: string; turnsLeft: number } | null; // counting-down threat to reverse (v3.1)
  figures: PoliticalFigure[]; // domestic political cast (v4b) — named figures with loyalty

  // events / policies
  pendingEventId?: string;
  usedEventIds: string[];
  usedPolicyIds: string[];
  chainQueue: { eventId: string; turnsLeft: number }[]; // scheduled follow-up (chained) events
  chronicle: ChronicleEntry[]; // milestone history (narrative layer)

  // transient (deterministic) — the most recent turn's explanation log
  log: LogEntry[];
}

/** A named domestic political figure (v4b) — the "who" the player contends with. */
export interface PoliticalFigure {
  id: string; // stable key within the game ('fig0'..)
  nameZh: string;
  title: string; // 头衔 e.g. 反对党领袖 / 军方统帅
  stance: string; // 立场
  personality: string; // 性格
  loyalty: number; // -100..100 toward the player
}

export interface PendingDecisions {
  taxRate?: number;
  spendingPctGdp?: number;
  allocation?: Allocation;
  enactPolicyIds?: string[];
  actions?: string[]; // active-action ids the player spends political capital on this turn
  focus?: string; // the year's single national focus (mutually exclusive strategic bet)
}

export interface CountryStart {
  gdp: number;
  sectors: Record<Sector, number>;
  productivity: number;
  techLevel: number;
  unemployment: number;
  inflation: number;
  population: number;
  popGrowth: number;
  medianAge: number;
  laborParticipation: number;
  educationLevel: number;
  inequality: number;
  healthIndex: number;
  approval: number;
  stability: number;
  militaryStrength: number;
  militaryReadiness: number;
  taxRate: number;
  spendingPctGdp: number;
  allocation: Allocation;
  debtPctGdp: number;
  creditRating: number;
  reserves: number;
  resourceDepletion: number;
  climateStress: number;
}

export interface CountryDef {
  id: string;
  name: string;
  nameZh: string;
  flag: string;
  govType: GovType;
  blurb: string; // one-line predicament (EN)
  blurbZh: string; // one-line predicament (ZH)
  traits: string[];
  trendGrowth: number;
  start: CountryStart;
}
