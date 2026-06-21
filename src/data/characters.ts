// Political figures (v4b): each game seeds a domestic cast of named, fictional politicians
// — the "who" the player contends with. Procedurally generated from a seed so each game is
// different but reproducible (save/reload identical). Loyalty drives drama in later steps.

import type { PoliticalFigure } from '../engine/types';
import { Rng, makeRngState } from '../engine/rng';

const SURNAMES = [
  '维', '卡', '洛', '穆', '谢', '安', '贝', '柯', '索', '费', '纳', '奥', '韩', '林', '赵',
  '沈', '江', '霍', '米', '蓝', '司', '邵', '岑', '聂', '车', '尤', '燕', '慕', '澹', '宿',
];
const GIVEN = [
  '伦', '德', '里', '安', '拉', '尼', '瓦', '蒙', '塞', '罗', '文', '哲', '川', '远', '岚',
  '宁', '望', '克', '岩', '澜', '野', '晟', '珩', '谌', '彻', '翊', '骁', '勘', '霆', '钧',
];

const EXTRA_TITLES = ['财政巨头', '改革派旗手', '地方实力派', '媒体大亨', '工会领袖', '国安首脑', '外交元老'];
const STANCES = ['改革派', '保守派', '民族主义', '自由派', '强硬鹰派', '技术官僚'];
const PERSONALITIES = ['野心勃勃', '圆滑世故', '刚直不阿', '忠诚可靠', '善变投机', '深谋远虑', '骄狂自负'];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}
function genName(rng: Rng, used: Set<string>): string {
  for (let tries = 0; tries < 12; tries++) {
    const len = rng.next() < 0.5 ? 1 : 2;
    let name = pick(rng, SURNAMES);
    for (let i = 0; i < len; i++) name += pick(rng, GIVEN);
    if (!used.has(name)) { used.add(name); return name; }
  }
  const fallback = pick(rng, SURNAMES) + pick(rng, GIVEN) + pick(rng, GIVEN);
  used.add(fallback);
  return fallback;
}

/** Deterministically generate a country's political cast from its id + seed. */
export function generateFigures(countryId: string, seed: number): PoliticalFigure[] {
  const rng = new Rng(makeRngState((seed ^ 0x9e3779b1 ^ hashStr(countryId)) & 0x7fffffff));
  const count = 4 + Math.floor(rng.next() * 3); // 4–6

  // every cast has an opposition leader + a military chief; rest drawn from the extra pool
  const extras = [...EXTRA_TITLES];
  for (let i = extras.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [extras[i], extras[j]] = [extras[j], extras[i]];
  }
  const titles = ['反对党领袖', '军方统帅', ...extras].slice(0, count);

  const used = new Set<string>();
  const figures: PoliticalFigure[] = [];
  for (let i = 0; i < count; i++) {
    const title = titles[i];
    let loyalty: number;
    if (title === '反对党领袖') loyalty = -50 + Math.floor(rng.next() * 30); // -50..-21 hostile
    else if (title === '军方统帅') loyalty = -15 + Math.floor(rng.next() * 40); // -15..24 wary
    else loyalty = -25 + Math.floor(rng.next() * 70); // -25..44 mixed
    figures.push({
      id: `fig${i}`,
      nameZh: genName(rng, used),
      title,
      stance: pick(rng, STANCES),
      personality: pick(rng, PERSONALITIES),
      loyalty,
    });
  }
  return figures;
}
