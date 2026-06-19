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
