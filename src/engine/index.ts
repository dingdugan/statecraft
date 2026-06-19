// Public engine API.
import { getCountry } from '../data/countries';
import { makeRngState } from './rng';
import { computeScore } from './reducers/score';
import { computeQol } from './reducers/social';
import { C } from './constants';
import type { GameState } from './types';

export function newGame(countryId: string, seed: number): GameState {
  const c = getCountry(countryId);
  const st = c.start;
  const s: GameState = {
    countryId: c.id,
    govType: c.govType,
    traits: [...c.traits],
    trendGrowth: c.trendGrowth,
    year: 2025,
    turn: 0,
    rng: makeRngState(seed),
    status: 'playing',

    gdp: st.gdp,
    gdpGrowthReal: c.trendGrowth,
    sectors: { ...st.sectors },
    productivity: st.productivity,
    unemployment: st.unemployment,
    inflation: st.inflation,

    population: st.population,
    popGrowth: st.popGrowth,
    medianAge: st.medianAge,
    laborParticipation: st.laborParticipation,
    educationLevel: st.educationLevel,

    inequality: st.inequality,
    healthIndex: st.healthIndex,
    qualityOfLife: 0,
    legitimacy: 0,

    approval: st.approval,
    stability: st.stability,
    unrest: 0,
    termYearsLeft: c.govType === 'democracy' ? C.TERM_LENGTH : 0,
    lowStabilityStreak: 0,

    taxRate: st.taxRate,
    spendingPctGdp: st.spendingPctGdp,
    allocation: { ...st.allocation },
    debtPctGdp: st.debtPctGdp,
    creditRating: st.creditRating,
    deficitPctGdp: 0,
    reserves: st.reserves,
    marketAccessLostYears: 0,

    prosperity: 0,
    score: 0,

    usedEventIds: [],
    usedPolicyIds: [],
    log: [],
  };
  computeQol(s);
  computeScore(s);
  return s;
}

export { advanceTurn } from './advanceTurn';
export { resolveEventChoice } from './reducers/events';
export { interestRate } from './reducers/fiscal';
export { getCountry, COUNTRIES, COUNTRY_IDS } from '../data/countries';
export * from './types';
