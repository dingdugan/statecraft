// Government-type modifiers. See docs/design-engine.md §5, §9.
import type { GovType } from './types';

/** Credit-rating bonus by government type + sovereign-wealth trait. */
export function govRatingBonus(g: GovType, traits: string[]): number {
  let b = g === 'democracy' ? 1 : g === 'monarchy' ? 1 : g === 'authoritarian' ? -1 : 0;
  if (traits.includes('sovereign_wealth')) b += 3;
  return b;
}

/** Stability floor: authoritarian/monarchy suppress visible unrest (resist longer),
 *  but having no electoral release valve makes them fail via revolution, not vote-out. */
export function govStabBonus(g: GovType): number {
  return g === 'authoritarian' ? 10 : g === 'monarchy' ? 8 : g === 'hybrid' ? 5 : 0;
}
