// Save/load is trivial because GameState is plain JSON-serializable data (RNG included).
import type { GameState } from './types';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(str: string): GameState {
  return JSON.parse(str) as GameState;
}

/** Deterministic fingerprint of canonical state (excludes the transient turn log). */
export function fingerprint(s: GameState): string {
  const { log: _log, ...rest } = s;
  return JSON.stringify(rest);
}
