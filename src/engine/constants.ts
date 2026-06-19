// v0 tuning surface. Every coefficient here is meant to be balanced in the loop.
// See docs/design-engine.md §6.

import type { SpendCategory } from './types';

export const C = {
  // economy
  GROWTH_SD: 0.012,
  INFL_PERSIST: 0.55,
  INFL_SD: 0.008,
  K_INFL_GAP: 0.25,
  K_INFL_DEF: 0.1,
  K_OKUN: 0.4,
  U_MEANREV: 0.2,
  NAT_U: 0.05,
  K_EDU: 0.01,
  K_AGE: 0.006,
  K_INST: 0.04,
  K_TAXDRAG: 0.05,
  K_PROD_EDU: 0.5,

  // fiscal
  K_LAFFER: 0.3,
  RATING_MAX_STEP: 2,

  // politics
  W_GROWTH: 0.8,
  W_UNEMP: 0.5,
  W_INFL: 0.6,
  W_SERV: 1.0,
  K_TAXPAIN: 0.8,
  A_MEANREV: 0.1,
  UNREST_DECAY: 6,
  STAB_MAX_STEP: 8,
  TERM_LENGTH: 4,
  ELECTION_LOSE_BELOW: 35,

  // demographics (AGE_DRIFT already scaled so ~0.2 yr/yr for a low-growth country)
  AGE_DRIFT: 15,
  TREND_POP_REF: 0.01,

  // technology
  TECH_STEP: 0.05, // max techLevel move per year
  TECH_EDU: 0.006, // education contribution to tech target
  K_TECH_GROWTH: 0.015, // growth bonus per unit techLevel above 1.0

  // military
  MIL_READY_STEP: 8, // max readiness move per year
  MIL_STR_STEP: 3, // max strength move per year

  // diplomacy & trade
  REL_STEP: 3, // relation drift toward baseline per year
  REL_NOISE: 1.5,
  K_TRADE: 0.08, // growth per unit trade balance
  K_SANCTION: 0.04, // growth drag at full sanction pressure

  // social
  HEALTH_STEP: 4, // max health-index move per year
  INEQ_UNEMP: 0.03, // inequality pressure per unit unemployment gap
  INEQ_WELFARE: 0.02, // inequality relief from welfare adequacy
  INEQ_EDU: 0.004, // inequality relief from education
  UNREST_INEQ: 40, // unrest pressure from Gini above 0.45

  // scoring
  REF_PC: 5000,

  // events
  EVENT_CHANCE: 0.55,

  // end
  END_YEAR: 2075,

  // spend-effect references (healthy spend as fraction of GDP) and gains
  REF: {
    infrastructure: 0.04,
    rnd: 0.02,
    education: 0.05,
    healthcare: 0.07,
    welfare: 0.06,
    military: 0.02,
  } as Record<SpendCategory, number>,
  GAIN_GROWTH: 0.015,
} as const;

// lever ranges
export const TAX_MIN = 0.1;
export const TAX_MAX = 0.6;
export const SPEND_MIN = 0.1;
export const SPEND_MAX = 0.7;
