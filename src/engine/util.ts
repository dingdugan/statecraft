// Pure numeric/util helpers used across reducers.

import type { Allocation, GameState, SpendCategory } from './types';
import { C } from './constants';

export const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

/** move `cur` toward `target` by at most `maxStep` (sticky adjustment) */
export function moveToward(cur: number, target: number, maxStep: number): number {
  const d = target - cur;
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export function round(x: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}

export function hasTrait(s: GameState, trait: string): boolean {
  return s.traits.includes(trait);
}

const CATS: SpendCategory[] = [
  'military',
  'education',
  'healthcare',
  'infrastructure',
  'welfare',
  'rnd',
];

/** Normalize allocation shares to sum to 1. Empty/zero → even split. */
export function normalizeAllocation(a: Allocation): Allocation {
  const sum = CATS.reduce((acc, k) => acc + Math.max(0, a[k] || 0), 0);
  if (sum <= 0) {
    const even = 1 / CATS.length;
    return CATS.reduce((o, k) => ((o[k] = even), o), {} as Allocation);
  }
  return CATS.reduce((o, k) => ((o[k] = Math.max(0, a[k] || 0) / sum), o), {} as Allocation);
}

/** spend in a category as a fraction of GDP */
export function spendShareGdp(s: GameState, cat: SpendCategory): number {
  return s.spendingPctGdp * s.allocation[cat];
}

/** diminishing-returns effect of a category's spend vs its healthy reference */
export function spendEffect(s: GameState, cat: SpendCategory, gain: number): number {
  const a = spendShareGdp(s, cat);
  const ref = C.REF[cat];
  return gain * Math.tanh((a - ref) / ref);
}

/** services satisfaction 0..1 over the approval-relevant categories */
export function servicesSatisfaction(s: GameState): number {
  const cats: SpendCategory[] = ['healthcare', 'education', 'welfare'];
  const adequacy = cats.map((c) => Math.tanh(spendShareGdp(s, c) / C.REF[c]));
  return adequacy.reduce((a, b) => a + b, 0) / cats.length; // ~0..1
}

export const SPEND_CATEGORIES = CATS;
