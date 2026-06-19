import type { WorldState } from '../engine/world';
import { serializeWorld, deserializeWorld } from '../engine/save';
import { COUNTRY_IDS, getCountry } from '../data/countries';

// v2 keys (world saves). Distinct from any old v1 single-country saves.
const AUTO_KEY = 'statecraft.auto.v2';
const slotKey = (n: number) => `statecraft.slot.v2.${n}`;
export const SLOTS = [1, 2, 3];

/** Read + validate a world save. Always → null on any failure (storage unavailable,
 *  parse error, structurally invalid, unknown player country) so a render never crashes. */
function safeGet(key: string): WorldState | null {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const w = deserializeWorld(v);
    if (w && COUNTRY_IDS.includes(w.playerId)) return w;
    return null;
  } catch {
    return null;
  }
}

export function autoSave(w: WorldState): void {
  try {
    localStorage.setItem(AUTO_KEY, serializeWorld(w));
  } catch {
    /* storage may be unavailable / full; non-fatal */
  }
}
export function loadAuto(): WorldState | null {
  return safeGet(AUTO_KEY);
}
export function saveSlot(n: number, w: WorldState): void {
  try {
    localStorage.setItem(slotKey(n), serializeWorld(w));
  } catch {
    /* non-fatal */
  }
}
export function loadSlot(n: number): WorldState | null {
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
  const w = loadSlot(n);
  if (!w) return { slot: n, label: null };
  const g = w.countries[w.playerId];
  const c = getCountry(g.countryId);
  return { slot: n, label: `${c.flag} ${c.nameZh} · ${g.year}年 · 评分${g.score.toFixed(0)}` };
}
