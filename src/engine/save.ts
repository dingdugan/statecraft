// Save/load is trivial because GameState is plain JSON-serializable data (RNG included).
import type { GameState } from './types';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

/** Returns null on parse failure or a structurally-invalid blob (corrupt/old save). */
export function deserialize(str: string): GameState | null {
  try {
    const o = JSON.parse(str) as Partial<GameState> | null;
    if (o && typeof o === 'object' && typeof o.countryId === 'string' && typeof o.status === 'string') {
      // backfill array fields added in later versions so older saves stay loadable
      o.usedEventIds ??= [];
      o.usedPolicyIds ??= [];
      o.log ??= [];
      // numeric fields added by later system iterations — default to prevent NaN on old saves
      if (typeof o.inequality !== 'number') o.inequality = 0.4;
      if (typeof o.healthIndex !== 'number') o.healthIndex = 70;
      if (typeof o.qualityOfLife !== 'number') o.qualityOfLife = 60;
      if (typeof o.legitimacy !== 'number') o.legitimacy = 55;
      if (typeof o.techLevel !== 'number') o.techLevel = 1.0;
      if (typeof o.militaryStrength !== 'number') o.militaryStrength = 50;
      if (typeof o.militaryReadiness !== 'number') o.militaryReadiness = 60;
      if (typeof o.coupRisk !== 'number') o.coupRisk = 0;
      if (typeof o.relations !== 'object' || o.relations === null) o.relations = {};
      if (typeof o.globalStanding !== 'number') o.globalStanding = 50;
      if (typeof o.tradeBalance !== 'number') o.tradeBalance = 0;
      if (typeof o.sanctionPressure !== 'number') o.sanctionPressure = 0;
      if (o.warWith === undefined) o.warWith = null;
      if (typeof o.warScore !== 'number') o.warScore = 0;
      if (typeof o.warExhaustion !== 'number') o.warExhaustion = 0;
      if (typeof o.commodityPrice !== 'number') o.commodityPrice = 1.0;
      if (typeof o.resourceDepletion !== 'number') o.resourceDepletion = 0;
      if (typeof o.resourceIncome !== 'number') o.resourceIncome = 0;
      if (typeof o.emissions !== 'number') o.emissions = 40;
      if (typeof o.climateStress !== 'number') o.climateStress = 0;
      return o as GameState;
    }
    return null;
  } catch {
    return null;
  }
}

/** Deterministic fingerprint of canonical state (excludes the transient turn log). */
export function fingerprint(s: GameState): string {
  const { log: _log, ...rest } = s;
  return JSON.stringify(rest);
}
