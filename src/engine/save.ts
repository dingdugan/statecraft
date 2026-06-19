// Save/load is trivial because GameState is plain JSON-serializable data (RNG included).
import type { GameState, RngState } from './types';
import type { WorldState } from './world';
import { getCountry } from '../data/countries';
import { makeRngState } from './rng';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

/** Returns null on parse failure or a structurally-invalid blob (corrupt/old save). */
export function deserialize(str: string): GameState | null {
  try {
    const o = JSON.parse(str) as Partial<GameState> | null;
    if (o && typeof o === 'object' && typeof o.countryId === 'string' && typeof o.status === 'string') {
      // backfill array fields added in later versions so older saves stay loadable
      // base fields (present in real saves; backfilled defensively for partial/corrupt/old blobs
      // — deserialize is the only validation boundary, so it must guarantee what reducers read)
      if (!Array.isArray(o.traits)) o.traits = [...getCountry(o.countryId as string).traits];
      if (typeof o.trendGrowth !== 'number') o.trendGrowth = getCountry(o.countryId as string).trendGrowth;
      if (typeof o.lowStabilityStreak !== 'number') o.lowStabilityStreak = 0;
      if (typeof o.deficitPctGdp !== 'number') o.deficitPctGdp = 0;
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
      if (typeof o.victoryStreak !== 'number') o.victoryStreak = 0;
      if (typeof o.priceLevel !== 'number') o.priceLevel = 1.0;
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

// ─── world (v2) ────────────────────────────────────────────────────────────────
export function serializeWorld(w: WorldState): string {
  return JSON.stringify(w);
}

/** Validate + backfill a world save; reuses the per-country deserialize for each nation. */
export function deserializeWorld(str: string): WorldState | null {
  try {
    const o = JSON.parse(str) as
      | { countries?: Record<string, unknown>; playerId?: unknown; turn?: unknown; news?: unknown; rng?: unknown }
      | null;
    if (!o || typeof o !== 'object' || typeof o.playerId !== 'string' || !o.countries || typeof o.countries !== 'object') {
      return null;
    }
    const countries: Record<string, GameState> = {};
    for (const id of Object.keys(o.countries)) {
      const cs = deserialize(JSON.stringify(o.countries[id]));
      if (!cs) return null;
      countries[id] = cs;
    }
    if (!countries[o.playerId]) return null;
    return {
      countries,
      playerId: o.playerId,
      turn: typeof o.turn === 'number' ? o.turn : 0,
      news: Array.isArray(o.news) ? (o.news as WorldState['news']) : [],
      rng:
        o.rng && typeof o.rng === 'object' && typeof (o.rng as RngState).cursor === 'number'
          ? (o.rng as RngState)
          : makeRngState(0),
    };
  } catch {
    return null;
  }
}

/** Deterministic fingerprint of the whole world (per-country fingerprints + meta). */
export function worldFingerprint(w: WorldState): string {
  const ids = Object.keys(w.countries).sort();
  return ids.map((id) => `${id}:${fingerprint(w.countries[id])}`).join('||') + `#${w.playerId}#${w.turn}#${w.rng?.seed ?? 0}:${w.rng?.cursor ?? 0}`;
}
