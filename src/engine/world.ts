// v2 world layer — full 16-country simulation by wrapping the existing single-country
// engine. Each country is a complete GameState; advanceWorld runs advanceTurn for every
// country each turn, then reconciles the international layer (relations, wars, diplomacy).
// See docs/design-world-v2.md.
import type { GameState, PendingDecisions, RngState } from './types';
import { advanceTurn } from './advanceTurn';
import { resolveEventChoice } from './reducers/events';
import { Rng } from './rng';
import { clamp } from './util';
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
  rng: RngState; // world-level entropy (diplomacy shocks); player/NPC turns keep their own
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

  const wrng = new Rng({ ...world.rng });
  const w: WorldState = {
    countries: next,
    playerId: world.playerId,
    turn: next[world.playerId].turn,
    rng: world.rng,
    news: [],
  };
  worldSync(w);
  stepWorldRelations(w, wrng); // world-level diplomacy drift (can sour into war / warm into alliance)
  w.rng = wrng.state;
  w.news = genNews(before, w.countries, w.playerId);
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
        const avg = (ra + rb) / 2;
        A.relations[b] = avg;
        B.relations[a] = avg;
      }
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

/** Random diplomacy shocks between countries (symmetric), biased by ideology + rivalry.
 *  Lets relations wander, occasionally souring past the war threshold or warming to alliance. */
function stepWorldRelations(w: WorldState, rng: Rng): void {
  const ids = COUNTRY_IDS.filter((id) => w.countries[id]?.status === 'playing');
  if (ids.length < 2) return;
  const apply = (a: string, b: string, v: number): void => {
    const nv = clamp(v, -100, 100);
    w.countries[a].relations[b] = nv;
    w.countries[b].relations[a] = nv;
  };
  // routine drift: a few small symmetric shocks, biased by ideology + rivalry
  const events = 2 + Math.floor(rng.next() * 3); // 2–4 per year
  for (let k = 0; k < events; k++) {
    const a = ids[Math.floor(rng.next() * ids.length)];
    const b = ids[Math.floor(rng.next() * ids.length)];
    if (a === b) continue;
    const A = getCountry(a);
    const B = getCountry(b);
    let bias = 0;
    if (A.govType === B.govType) bias += 3;
    else if ((A.govType === 'democracy') !== (B.govType === 'democracy')) bias -= 4;
    if (A.traits.includes('oil_exporter') && B.traits.includes('oil_exporter')) bias -= 2; // resource rivalry
    apply(a, b, (w.countries[a].relations[b] ?? 0) + rng.normal(bias, 12));
  }
  // occasional flashpoint: a crisis that plunges a pair into deep hostility. The slow
  // REL_STEP (3/yr) regression keeps them below the −75 war line for several years, so
  // each side's stepWar gets repeated chances (WAR_START_CHANCE) to ignite a real war.
  if (rng.next() < 0.1) {
    const a = ids[Math.floor(rng.next() * ids.length)];
    const b = ids[Math.floor(rng.next() * ids.length)];
    if (a !== b) apply(a, b, -(76 + rng.next() * 19)); // −76..−95
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

/** Scan before→after for newsworthy world changes (collapses, wars, recessions, the
 *  player's alliances/rivalries). */
function genNews(before: Record<string, GameState>, after: Record<string, GameState>, playerId: string): NewsItem[] {
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
    // the player's relations crossing alliance / rivalry thresholds
    if (id !== playerId) {
      const rb = before[playerId]?.relations[id];
      const ra = after[playerId]?.relations[id];
      if (typeof rb === 'number' && typeof ra === 'number') {
        if (rb <= 40 && ra > 40) news.push({ kind: 'diplo', who: id, msg: `${flag} 你与 ${name} 结为盟友` });
        else if (rb >= -40 && ra < -40) news.push({ kind: 'diplo', who: id, msg: `${flag} 你与 ${name} 关系恶化为敌对` });
      }
    }
  }
  return news.slice(0, 8);
}
