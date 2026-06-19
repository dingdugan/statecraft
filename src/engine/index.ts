// Public engine API.
import { getCountry } from '../data/countries';
import { makeRngState } from './rng';
import { computeScore } from './reducers/score';
import { computeQol } from './reducers/social';
import { initRelations, computeDiplomacy } from './reducers/diplomacy';
import { computeResources } from './reducers/resources';
import { getScenario } from '../data/scenarios';
import { C } from './constants';
import { COUNTRY_IDS } from '../data/countries';
import type { WorldState } from './world';
import type { GameState } from './types';

export function newGame(countryId: string, seed: number, scenarioId = 'standard'): GameState {
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
    techLevel: st.techLevel,
    unemployment: st.unemployment,
    inflation: st.inflation,
    priceLevel: 1.0,

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

    militaryStrength: st.militaryStrength,
    militaryReadiness: st.militaryReadiness,
    coupRisk: 0,

    relations: {},
    globalStanding: 0,
    tradeBalance: 0,
    sanctionPressure: 0,

    warWith: null,
    warScore: 0,
    warExhaustion: 0,

    commodityPrice: 1.0,
    resourceDepletion: st.resourceDepletion,
    resourceIncome: 0,
    emissions: 0,
    climateStress: st.climateStress,

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
    victoryStreak: 0,

    usedEventIds: [],
    usedPolicyIds: [],
    log: [],
  };
  computeResources(s);
  computeQol(s);
  initRelations(s);
  computeScore(s);
  if (scenarioId !== 'standard') {
    getScenario(scenarioId).apply(s);
    computeDiplomacy(s);
    computeQol(s);
    computeScore(s);
  }
  return s;
}

/** Build a full 16-country world. The player country uses the given seed + scenario;
 *  every other country gets a derived seed and the standard scenario. */
export function newWorld(playerId: string, seed: number, scenarioId = 'standard'): WorldState {
  const countries: Record<string, GameState> = {};
  COUNTRY_IDS.forEach((id, i) => {
    const cseed = id === playerId ? seed : ((seed + (i + 1) * 0x9e3779b1) | 0) & 0x7fffffff;
    countries[id] = newGame(id, cseed, id === playerId ? scenarioId : 'standard');
  });
  return { countries, playerId, turn: 0, news: [], rng: makeRngState((seed ^ 0x6d2b79f5) & 0x7fffffff) };
}

export { advanceTurn } from './advanceTurn';
export { advanceWorld } from './world';
export type { WorldState, NewsItem } from './world';
export { resolveEventChoice } from './reducers/events';
export { interestRate } from './reducers/fiscal';
export { getCountry, COUNTRIES, COUNTRY_IDS } from '../data/countries';
export * from './types';
