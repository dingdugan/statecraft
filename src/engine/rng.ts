// Deterministic, serializable PRNG (Mulberry32). See docs/design-engine.md §2.
// The only entropy source in the engine. Its state lives inside GameState so a
// JSON round-trip reproduces the exact same sequence.

import type { RngState } from './types';

export class Rng {
  constructor(public state: RngState) {}

  /** float in [0, 1) */
  next(): number {
    this.state.cursor = (this.state.cursor + 0x6d2b79f5) | 0;
    let t = this.state.cursor;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** float in [min, max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Box–Muller normal draw (uses two uniforms) */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** weighted pick; weights need not be normalized */
  pick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

export function makeRngState(seed: number): RngState {
  // normalize seed into a 32-bit cursor start; keep seed for display/debug
  return { seed, cursor: seed | 0 };
}
