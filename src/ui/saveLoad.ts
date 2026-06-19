import type { GameState } from '../engine/types';
import { serialize, deserialize } from '../engine/save';
import { COUNTRY_IDS, getCountry } from '../data/countries';

const AUTO_KEY = 'statecraft.auto';
const slotKey = (n: number) => `statecraft.slot.${n}`;
export const SLOTS = [1, 2, 3];

/** Read + validate a save. Tolerates: storage unavailable, parse errors, structurally
 *  invalid blobs, and saves referencing a country that no longer exists. Always → null
 *  on any failure, so a corrupt/stale entry can never crash a render path. */
function safeGet(key: string): GameState | null {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const g = deserialize(v);
    if (g && COUNTRY_IDS.includes(g.countryId)) return g;
    return null;
  } catch {
    return null;
  }
}

export function autoSave(s: GameState): void {
  try {
    localStorage.setItem(AUTO_KEY, serialize(s));
  } catch {
    /* storage may be unavailable / full; non-fatal */
  }
}
export function loadAuto(): GameState | null {
  return safeGet(AUTO_KEY);
}
export function saveSlot(n: number, s: GameState): void {
  try {
    localStorage.setItem(slotKey(n), serialize(s));
  } catch {
    /* non-fatal */
  }
}
export function loadSlot(n: number): GameState | null {
  return safeGet(slotKey(n));
}
export function clearSlot(n: number): void {
  try {
    localStorage.removeItem(slotKey(n));
  } catch {
    /* non-fatal */
  }
}

export interface SlotInfo {
  slot: number;
  label: string | null;
}
export function slotInfo(n: number): SlotInfo {
  const g = loadSlot(n); // already validated: countryId is resolvable
  if (!g) return { slot: n, label: null };
  const c = getCountry(g.countryId);
  return { slot: n, label: `${c.flag} ${c.nameZh} · ${g.year}年 · 评分${g.score.toFixed(0)}` };
}
