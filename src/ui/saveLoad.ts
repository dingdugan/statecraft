import type { GameState } from '../engine/types';
import { serialize, deserialize } from '../engine/save';
import { getCountry } from '../data/countries';

const AUTO_KEY = 'statecraft.auto';
const slotKey = (n: number) => `statecraft.slot.${n}`;
export const SLOTS = [1, 2, 3];

export function autoSave(s: GameState): void {
  try {
    localStorage.setItem(AUTO_KEY, serialize(s));
  } catch {
    /* storage may be unavailable; non-fatal */
  }
}
export function loadAuto(): GameState | null {
  const v = localStorage.getItem(AUTO_KEY);
  return v ? deserialize(v) : null;
}
export function saveSlot(n: number, s: GameState): void {
  localStorage.setItem(slotKey(n), serialize(s));
}
export function loadSlot(n: number): GameState | null {
  const v = localStorage.getItem(slotKey(n));
  return v ? deserialize(v) : null;
}
export function clearSlot(n: number): void {
  localStorage.removeItem(slotKey(n));
}

export interface SlotInfo {
  slot: number;
  label: string | null;
}
export function slotInfo(n: number): SlotInfo {
  const g = loadSlot(n);
  if (!g) return { slot: n, label: null };
  const c = getCountry(g.countryId);
  return { slot: n, label: `${c.flag} ${c.nameZh} · ${g.year}年 · 评分${g.score.toFixed(0)}` };
}
