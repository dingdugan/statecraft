// Core type contracts for the simulation engine. See docs/design-engine.md §1.

export type GovType = 'democracy' | 'authoritarian' | 'monarchy' | 'hybrid';
export type Status = 'playing' | 'bankrupt' | 'revolution' | 'voted_out' | 'ended';
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
  productivity: number; // index, 1.00 = baseline
  unemployment: number; // fraction [0.01, 0.45]
  inflation: number; // fraction [-0.05, 0.40]

  // population
  population: number; // millions
  popGrowth: number; // fraction (may be negative)
  medianAge: number;
  laborParticipation: number;
  educationLevel: number; // index 0..100

  // government / politics
  approval: number; // 0..100
  stability: number; // 0..100
  unrest: number; // 0..100 accumulator
  termYearsLeft: number; // democracies only
  lowStabilityStreak: number; // consecutive turns at stability <= 5

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

  // events
  pendingEventId?: string;
  usedEventIds: string[];

  // transient (deterministic) — the most recent turn's explanation log
  log: LogEntry[];
}

export interface PendingDecisions {
  taxRate?: number;
  spendingPctGdp?: number;
  allocation?: Allocation;
  enactPolicyIds?: string[];
}

export interface CountryStart {
  gdp: number;
  sectors: Record<Sector, number>;
  productivity: number;
  unemployment: number;
  inflation: number;
  population: number;
  popGrowth: number;
  medianAge: number;
  laborParticipation: number;
  educationLevel: number;
  approval: number;
  stability: number;
  taxRate: number;
  spendingPctGdp: number;
  allocation: Allocation;
  debtPctGdp: number;
  creditRating: number;
  reserves: number;
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
