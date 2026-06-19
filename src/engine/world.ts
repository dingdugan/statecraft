// v2 world layer — full 16-country simulation by wrapping the existing single-country
// engine. Each country is a complete GameState; advanceWorld runs advanceTurn for every
// country each turn, then worldSync reconciles cross-country relations and wars.
// See docs/design-world-v2.md.
import type { GameState, PendingDecisions } from './types';
import { advanceTurn } from './advanceTurn';
import { resolveEventChoice } from './reducers/events';
import { aiDecide } from './ai';
import { COUNTRY_IDS, getCountry } from '../data/countries';

export interface NewsItem {
  kind: 'econ' | 'war' | 'diplo' | 'politics' | 'disaster';
  who: string;
  msg: string;
}

export interface WorldState {
  countries: Record<string, GameState>;
  playerId: string;
  turn: number;
  news: NewsItem[];
}

/** Advance every country one year, then reconcile the international layer. Pure. */
export function advanceWorld(world: WorldState, playerDecisions: PendingDecisions = {}): WorldState {
  const player = world.countries[world.playerId];
  if (!player || player.status !== 'playing') return world;
  if (player.pendingEventId) throw new Error('resolve the pending event before advancing the world');

  const before = world.countries;
  const next: Record<string, GameState> = {};
  for (const id of COUNTRY_IDS) {
    const cs = before[id];
    if (!cs) continue;
    if (cs.status !== 'playing') {
      next[id] = cs; // a country that already reached an end-state is frozen
      continue;
    }
    const decisions = id === world.playerId ? playerDecisions : aiDecide(cs);
    let advanced = advanceTurn(cs, decisions);
    // NPCs auto-resolve any fired event (option 0); the player's event waits for them
    if (id !== world.playerId && advanced.pendingEventId) {
      advanced = resolveEventChoice(advanced, advanced.pendingEventId, 0);
    }
    next[id] = advanced;
  }

  const w: WorldState = {
    countries: next,
    playerId: world.playerId,
    turn: next[world.playerId].turn,
    news: [],
  };
  worldSync(w);
  w.news = genNews(before, w.countries);
  return w;
}

/** Reconcile relations (make A↔B symmetric) and wars (pull both sides into a conflict). */
function worldSync(w: WorldState): void {
  const ids = Object.keys(w.countries);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const A = w.countries[a];
      const B = w.countries[b];
      const ra = A.relations[b];
      const rb = B.relations[a];
      if (typeof ra === 'number' && typeof rb === 'number') {
        const avg = (ra + rb) / 2; // converge each side's view of the other
        A.relations[b] = avg;
        B.relations[a] = avg;
      }
      // symmetric war involvement
      if (A.warWith === b && !B.warWith && B.status === 'playing') {
        B.warWith = a;
        B.warScore = -A.warScore;
      } else if (B.warWith === a && !A.warWith && A.status === 'playing') {
        A.warWith = b;
        A.warScore = -B.warScore;
      }
    }
  }
}

const END_LABELS: Record<string, string> = {
  bankrupt: '主权违约破产',
  revolution: '爆发革命、政权倾覆',
  coup: '发生军事政变',
  defeated: '战败亡国',
  voted_out: '政府在大选中下台',
  victory: '迈入鼎盛、缔造时代',
  ended: '走完一个时代',
};

/** Scan before→after for newsworthy world changes (collapses, new wars, recessions). */
function genNews(before: Record<string, GameState>, after: Record<string, GameState>): NewsItem[] {
  const news: NewsItem[] = [];
  for (const id of Object.keys(after)) {
    const b = before[id];
    const a = after[id];
    if (!b) continue;
    const flag = getCountry(id).flag;
    const name = getCountry(id).nameZh;
    if (b.status === 'playing' && a.status !== 'playing') {
      news.push({ kind: 'politics', who: id, msg: `${flag} ${name} ${END_LABELS[a.status] ?? a.status}` });
    }
    if (!b.warWith && a.warWith) {
      news.push({ kind: 'war', who: id, msg: `${flag} ${name} 与 ${getCountry(a.warWith).nameZh} 开战` });
    } else if (b.warWith && !a.warWith && a.status === 'playing') {
      news.push({ kind: 'war', who: id, msg: `${flag} ${name} 的战争结束了` });
    }
    if (a.gdpGrowthReal <= -0.04) {
      news.push({ kind: 'econ', who: id, msg: `${flag} ${name} 陷入衰退（${(a.gdpGrowthReal * 100).toFixed(1)}%）` });
    }
  }
  return news.slice(0, 8);
}
