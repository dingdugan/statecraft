import type { Allocation, GameState, SpendCategory } from '../engine/types';
import type { WorldState } from '../engine/world';
import { COUNTRIES, getCountry } from '../data/countries';
import { getEvent } from '../data/events';
import { POLICIES } from '../data/policies';
import { ACTIONS, getAction } from '../data/actions';
import { getMandate } from '../data/mandates';
import { SCENARIOS } from '../data/scenarios';
import { SPEND_CATEGORIES, normalizeAllocation } from '../engine/util';
import { previewTurn } from '../engine';
import {
  briefings, fmtMoney, fmtMoneyShort, fmtPct, fmtPop, fmtSigned,
  GOV_LABELS, ratingLabel, SPEND_LABELS,
} from './format';

const esc = (x: string) => x.replace(/</g, '&lt;');

function stat(k: string, v: string, tone = ''): string {
  return `<div class="stat"><span class="k">${k}</span><span class="v ${tone}">${v}</span></div>`;
}

// ─── Menu / country select ───────────────────────────────────────────────────
export function menuHTML(hasAuto: boolean, selectedScenario: string): string {
  const cards = COUNTRIES.map((c) => {
    const s = c.start;
    const pc = ((s.gdp * 1e9) / (s.population * 1e6)).toFixed(0);
    return `<button class="country-card" data-action="pick" data-id="${c.id}">
      <div class="cc-top"><span class="flag">${c.flag}</span><span class="cc-name">${c.nameZh}<small>${esc(c.name)}</small></span></div>
      <div class="cc-blurb">${esc(c.blurbZh)}</div>
      <div class="cc-stats">
        <span>${GOV_LABELS[c.govType]}</span>
        <span>GDP ${fmtMoneyShort(s.gdp)}</span>
        <span>人口 ${fmtPop(s.population)}</span>
        <span>人均 $${Number(pc).toLocaleString('en-US')}</span>
        <span>债务 ${fmtPct(s.debtPctGdp, 0)}</span>
      </div>
    </button>`;
  }).join('');

  const scenarioBtns = SCENARIOS.map(
    (sc) =>
      `<button class="scenario ${sc.id === selectedScenario ? 'on' : ''}" data-action="scenario" data-id="${sc.id}" title="${esc(sc.descZh)}">${esc(sc.nameZh)}</button>`,
  ).join('');

  return `<div class="menu">
    <header class="title-block">
      <h1>Statecraft <span class="zh">庙堂</span></h1>
      <p class="tagline">没有地图，没有图形。只有你、你的国家，和一个个艰难的决定。<br/>选择一个国家，逐年执政，看经济·人口·政治如何连锁回响。</p>
    </header>
    ${hasAuto ? `<button class="btn primary continue" data-action="continue">▸ 继续上次的存档</button>` : ''}
    <h2 class="section-h">开局剧本</h2>
    <div class="scenario-row">${scenarioBtns}</div>
    <h2 class="section-h">选择你要执掌的国家</h2>
    <div class="country-grid">${cards}</div>
  </div>`;
}

// ─── Dashboard (vitals grouped by system) ──────────────────────────────────────
function tone3(v: number, warn: number, bad: number, invert = false): string {
  const x = invert ? -v : v;
  const w = invert ? -warn : warn;
  const b = invert ? -bad : bad;
  if (x <= b) return 'bad';
  if (x <= w) return 'warn';
  return 'good';
}

// ─── Tenure mandate card (v3.0): always-on "what am I playing toward" ──────────────
export function mandateHTML(s: GameState): string {
  const m = getMandate(s.mandateId);
  if (!m) return '';
  const pct = Math.round(m.progress(s) * 100);
  return `<div class="mandate">
    <div class="m-top"><span class="m-tag">任期使命</span><b class="m-title">${esc(m.titleZh)}</b><span class="m-pct">${pct}%</span></div>
    <p class="m-desc">${esc(m.descZh)}</p>
    <div class="m-bar"><div class="m-fill" style="width:${pct}%"></div></div>
    <div class="m-detail">${esc(m.detail(s))}</div>
  </div>`;
}

// ─── Decision preview (v3.0): exact predicted deltas of the pending decisions ───────
export function previewHTML(cur: GameState, next: GameState): string {
  const rows: { k: string; a: number; b: number; fmt: (v: number) => string; good: 1 | -1 }[] = [
    { k: '实际增长', a: cur.gdpGrowthReal * 100, b: next.gdpGrowthReal * 100, fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, good: 1 },
    { k: '赤字 %GDP', a: cur.deficitPctGdp * 100, b: next.deficitPctGdp * 100, fmt: (v) => `${v.toFixed(1)}%`, good: -1 },
    { k: '债务 %GDP', a: cur.debtPctGdp * 100, b: next.debtPctGdp * 100, fmt: (v) => `${v.toFixed(0)}%`, good: -1 },
    { k: '支持率', a: cur.approval, b: next.approval, fmt: (v) => v.toFixed(0), good: 1 },
    { k: '稳定', a: cur.stability, b: next.stability, fmt: (v) => v.toFixed(0), good: 1 },
    { k: '治国评分', a: cur.score, b: next.score, fmt: (v) => v.toFixed(0), good: 1 },
  ];
  const cells = rows.map((r) => {
    const d = r.b - r.a;
    const flat = Math.abs(d) < 0.05;
    const tone = flat ? '' : (d > 0) === (r.good === 1) ? 'good' : 'bad';
    const arrow = flat ? '→' : d > 0 ? '▲' : '▼';
    return `<div class="pv-row"><span class="pv-k">${r.k}</span><span class="pv-v">${r.fmt(r.a)} <span class="pv-d ${tone}">${arrow} ${r.fmt(r.b)}</span></span></div>`;
  }).join('');
  return `<div class="preview"><div class="pv-head">推进预测 · ${next.year} 年</div>${cells}</div>`;
}

export function dashboardHTML(s: GameState): string {
  const pc = (s.gdp * 1e9) / (s.population * 1e6);

  const econ = [
    stat('GDP（名义）', fmtMoney(s.gdp)),
    stat('人均 GDP', `$${pc.toLocaleString('en-US', { maximumFractionDigits: 0 })}`),
    stat('实际增长', fmtSigned(s.gdpGrowthReal), tone3(s.gdpGrowthReal, 0.005, 0)),
    stat('通胀', fmtPct(s.inflation), tone3(Math.abs(s.inflation - 0.02), 0.04, 0.08, true)),
    stat('失业率', fmtPct(s.unemployment), tone3(s.unemployment, 0.08, 0.12, true)),
    stat('生产率指数', s.productivity.toFixed(2)),
    stat('科技水平', s.techLevel.toFixed(2), tone3(s.techLevel, 1.0, 0.7)),
  ].join('');

  const pop = [
    stat('总人口', fmtPop(s.population)),
    stat('人口增长', fmtSigned(s.popGrowth, 2)),
    stat('年龄中位数', `${s.medianAge.toFixed(0)} 岁`),
    stat('教育水平', `${s.educationLevel.toFixed(0)} / 100`),
  ].join('');

  const fiscal = [
    stat('税收（占GDP）', fmtPct(s.taxRate, 0)),
    stat('支出（占GDP）', fmtPct(s.spendingPctGdp, 0)),
    stat('财政赤字', fmtSigned(-s.deficitPctGdp), tone3(s.deficitPctGdp, 0.04, 0.08, true)),
    stat('公共债务', fmtPct(s.debtPctGdp, 0), tone3(s.debtPctGdp, 0.9, 1.6, true)),
    stat('信用评级', ratingLabel(s.creditRating), tone3(s.creditRating, 12, 6)),
    stat('储备', fmtMoney(s.reserves), tone3(s.reserves, 1, -0.0001)),
  ].join('');

  const politics = [
    stat('支持率', s.approval.toFixed(0), tone3(s.approval, 45, 35)),
    stat('稳定度', s.stability.toFixed(0), tone3(s.stability, 50, 30)),
    stat('社会动荡', s.unrest.toFixed(0), tone3(s.unrest, 45, 70, true)),
    stat('政体', GOV_LABELS[s.govType]),
    ...(s.govType === 'democracy' ? [stat('距下次大选', `${Math.max(0, s.termYearsLeft)} 年`)] : []),
  ].join('');

  const social = [
    stat('生活质量', s.qualityOfLife.toFixed(0), tone3(s.qualityOfLife, 55, 35)),
    stat('健康指数', s.healthIndex.toFixed(0), tone3(s.healthIndex, 55, 35)),
    stat('不平等(基尼)', s.inequality.toFixed(2), tone3(s.inequality, 0.42, 0.55, true)),
    stat('合法性', s.legitimacy.toFixed(0), tone3(s.legitimacy, 50, 35)),
  ].join('');

  const military = [
    stat('军力指数', s.militaryStrength.toFixed(0), tone3(s.militaryStrength, 40, 20)),
    stat('战备', s.militaryReadiness.toFixed(0), tone3(s.militaryReadiness, 55, 35)),
    stat('政变风险', s.coupRisk.toFixed(0), tone3(s.coupRisk, 40, 70, true)),
  ].join('');

  const allies = Object.values(s.relations).filter((r) => r > 40).length;
  const rivals = Object.values(s.relations).filter((r) => r < -40).length;
  const diplomacy = [
    stat('国际声望', s.globalStanding.toFixed(0), tone3(s.globalStanding, 45, 30)),
    stat('贸易差额', fmtSigned(s.tradeBalance), tone3(s.tradeBalance, 0, -0.03)),
    stat('制裁压力', s.sanctionPressure.toFixed(0), tone3(s.sanctionPressure, 30, 60, true)),
    stat('盟友 / 对手', `${allies} / ${rivals}`),
  ].join('');

  const atWar = s.warWith !== null;
  const war = [
    stat('战争状态', atWar ? `与 ${getCountry(s.warWith!).nameZh} 交战` : '和平', atWar ? 'bad' : 'good'),
    ...(atWar ? [stat('战局', s.warScore.toFixed(0), tone3(s.warScore, 0, -40))] : []),
    stat('战争疲劳', s.warExhaustion.toFixed(0), tone3(s.warExhaustion, 30, 60, true)),
  ].join('');

  const resources = [
    stat('资源收入', fmtPct(s.resourceIncome, 1), tone3(s.resourceIncome, 0.02, 0)),
    stat('大宗价格', s.commodityPrice.toFixed(2)),
    stat('资源枯竭', s.resourceDepletion.toFixed(0), tone3(s.resourceDepletion, 50, 75, true)),
    stat('碳排放', s.emissions.toFixed(0), tone3(s.emissions, 55, 75, true)),
    stat('气候压力', s.climateStress.toFixed(0), tone3(s.climateStress, 40, 65, true)),
  ].join('');

  const brief = briefings(s)
    .map((b) => `<li class="brief ${b.tone}"><span class="who">${b.who}</span>${esc(b.msg)}</li>`)
    .join('');

  return `<div class="dashboard">
    <div class="vitals">
      <section class="group"><h3>经济</h3>${econ}</section>
      <section class="group"><h3>人口</h3>${pop}</section>
      <section class="group"><h3>社会</h3>${social}</section>
      <section class="group"><h3>财政</h3>${fiscal}</section>
      <section class="group"><h3>政治</h3>${politics}</section>
      <section class="group"><h3>军事</h3>${military}</section>
      <section class="group"><h3>外交</h3>${diplomacy}</section>
      <section class="group"><h3>战争</h3>${war}</section>
      <section class="group"><h3>资源环境</h3>${resources}</section>
    </div>
    <section class="briefings"><h3>内阁简报</h3><ul>${brief}</ul></section>
  </div>`;
}

// ─── Decisions panel ───────────────────────────────────────────────────────────
function slider(id: string, min: number, max: number, step: number, val: number): string {
  return `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" />`;
}

export function decisionsHTML(
  s: GameState,
  pendingTax: number,
  pendingSpend: number,
  pendingAlloc: Allocation,
  pendingPolicies: string[],
  pendingActions: string[],
): string {
  const allocSliders = SPEND_CATEGORIES.map((c: SpendCategory) => {
    const raw = Math.round((pendingAlloc[c] ?? 0) * 1000);
    return `<div class="alloc-row" data-cat="${c}">
      <label>${SPEND_LABELS[c]}</label>
      ${slider(`alloc-${c}`, 0, 1000, 1, raw)}
      <span class="alloc-pct" id="allocpct-${c}">0%</span>
    </div>`;
  }).join('');

  const policyBtns = POLICIES.map((p) => {
    const used = s.usedPolicyIds.includes(p.id);
    const avail = p.available(s) && !used;
    const on = pendingPolicies.includes(p.id);
    return `<button class="policy ${on ? 'on' : ''} ${used ? 'used' : ''}" data-action="policy" data-id="${p.id}" ${avail ? '' : 'disabled'} title="${esc(p.descZh)}">
      ${used ? '✓已实施 ' : on ? '✓ ' : ''}${esc(p.nameZh)}<small>${esc(p.descZh)}</small>
    </button>`;
  }).join('');

  const selectedCost = pendingActions.reduce((sum, id) => sum + (getAction(id)?.cost ?? 0), 0);
  const actionBtns = ACTIONS.map((a) => {
    const on = pendingActions.includes(a.id);
    const dis = !a.available(s) || (!on && selectedCost + a.cost > s.politicalCapital);
    return `<button class="action ${a.category} ${on ? 'on' : ''}" data-action="action" data-id="${a.id}" ${dis ? 'disabled' : ''} title="${esc(a.descZh)}">
      ${on ? '✓ ' : ''}${esc(a.labelZh)} <span class="acost">${a.cost}⚙</span><small>${esc(a.descZh)}</small>
    </button>`;
  }).join('');

  const predicted = previewTurn(s, {
    taxRate: pendingTax,
    spendingPctGdp: pendingSpend,
    allocation: normalizeAllocation(pendingAlloc),
    enactPolicyIds: pendingPolicies,
    actions: pendingActions,
  });
  const preview = predicted ? previewHTML(s, predicted) : '';

  return `<div class="decisions">
    <h3>本年决策</h3>
    <div class="lever">
      <label>税收强度 <span id="taxval">${fmtPct(pendingTax, 0)}</span></label>
      ${slider('tax', 10, 60, 1, Math.round(pendingTax * 100))}
      <small>越高，财政收入越多，但过高（>52%）会拖累增长与征收效率。</small>
    </div>
    <div class="lever">
      <label>支出规模（占GDP） <span id="spendval">${fmtPct(pendingSpend, 0)}</span></label>
      ${slider('spend', 10, 70, 1, Math.round(pendingSpend * 100))}
      <small>支出 − 收入 = 赤字；赤字推高债务与利息。</small>
    </div>
    <div class="alloc">
      <label>预算分配 <small>（自动归一化为 100%）</small></label>
      ${allocSliders}
    </div>
    <div class="policies"><label>政策</label><div class="policy-grid">${policyBtns}</div></div>
    <div class="actions-panel"><label>主动行动 <small>政治资本 <b class="pc">${s.politicalCapital.toFixed(0)}</b> · 本回合已用 ${selectedCost}⚙</small></label><div class="action-grid">${actionBtns}</div></div>
    ${preview}
    <button class="btn primary advance" data-action="advance">推进一年 ▸ ${s.year + 1}</button>
  </div>`;
}

// ─── Event modal ────────────────────────────────────────────────────────────────
export function eventModalHTML(s: GameState): string {
  if (!s.pendingEventId) return '';
  const ev = getEvent(s.pendingEventId);
  if (!ev) return '';
  const opts = ev.options
    .map((o, i) => `<button class="btn opt" data-action="resolve" data-opt="${i}">${esc(o.labelZh)}</button>`)
    .join('');
  return `<div class="modal-backdrop"><div class="modal">
    <h2>⚡ ${esc(ev.titleZh)}</h2>
    <p>${esc(ev.descZh)}</p>
    <div class="opts">${opts}</div>
  </div></div>`;
}

// ─── Year report (log) ───────────────────────────────────────────────────────────
export function reportHTML(s: GameState): string {
  if (s.turn === 0 && s.log.length === 0) {
    const c = getCountry(s.countryId);
    return `<div class="report"><h3>${c.flag} ${c.nameZh} · ${s.year} 年</h3>
      <p class="muted">你接掌了国家。审视各项体征，做出本年的决策，然后推进一年。</p></div>`;
  }
  const items = s.log.length
    ? s.log.map((l) => `<li class="log ${l.kind}">${esc(l.msg)}</li>`).join('')
    : '<li class="log info muted">这一年平稳度过，无特别事件。</li>';
  return `<div class="report"><h3>${s.year} 年纪要</h3><ul>${items}</ul></div>`;
}

// ─── Chronicle (v2.6 narrative layer) ─────────────────────────────────────────────
export function chronicleHTML(s: GameState): string {
  if (!s.chronicle.length) return '';
  const items = s.chronicle
    .slice()
    .reverse()
    .map((c) => `<li class="chron"><span class="cyr">${c.year}</span><span class="ctxt">${esc(c.text)}</span></li>`)
    .join('');
  return `<div class="chronicle"><h3>📜 编年史</h3><ul>${items}</ul></div>`;
}

// ─── End screen ──────────────────────────────────────────────────────────────────
export function endHTML(s: GameState): string {
  const c = getCountry(s.countryId);
  const titles: Record<string, string> = {
    victory: '🏆 功成名就',
    bankrupt: '💥 国家破产',
    revolution: '🔥 政权倾覆',
    coup: '⚔️ 军事政变',
    defeated: '🏳️ 战败亡国',
    voted_out: '🗳️ 黯然下台',
    ended: '🏁 任期落幕',
  };
  const title = titles[s.status] ?? '游戏结束';
  return `<div class="end">
    <h1>${title}</h1>
    <p class="epitaph">${esc(s.endReason ?? '')}</p>
    <div class="final-score">最终治国评分 <b>${s.score.toFixed(0)}</b><span>/ 100</span></div>
    <div class="end-recap">
      ${stat('国家', `${c.flag} ${c.nameZh}`)}
      ${stat('执政至', `${s.year} 年`)}
      ${stat('人均GDP', `$${((s.gdp * 1e9) / (s.population * 1e6)).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)}
      ${stat('公共债务', fmtPct(s.debtPctGdp, 0))}
      ${stat('支持率', s.approval.toFixed(0))}
    </div>
    <button class="btn primary" data-action="menu">↺ 再来一局</button>
  </div>`;
}

// ─── World view (v2.2): news feed + nations table ────────────────────────────────
const REL_TIER = (r: number): string =>
  r > 40 ? '盟友' : r > 15 ? '友好' : r > -15 ? '中立' : r > -40 ? '紧张' : '敌对';
const STATUS_ZH: Record<string, string> = {
  bankrupt: '破产', revolution: '革命', coup: '政变', defeated: '战败',
  voted_out: '下台', victory: '鼎盛', ended: '落幕',
};

export function worldViewHTML(world: WorldState): string {
  const me = world.countries[world.playerId];
  const news = world.news.length
    ? world.news.map((n) => `<li class="news ${n.kind}">${esc(n.msg)}</li>`).join('')
    : '<li class="news muted">本年世界平静，无重大事件。</li>';

  const ranked = COUNTRIES.map((c) => world.countries[c.id])
    .filter((cs): cs is GameState => Boolean(cs))
    .sort((a, b) => b.gdp - a.gdp);

  const rows = ranked.map((cs, i) => {
    const c = getCountry(cs.countryId);
    const isMe = cs.countryId === world.playerId;
    const rel = isMe ? undefined : me.relations[cs.countryId];
    const relTone = rel === undefined ? '' : rel > 40 ? 'good' : rel < -40 ? 'bad' : '';
    const relTxt = isMe
      ? '<span class="muted">你</span>'
      : rel === undefined ? '—' : `${REL_TIER(rel)} ${rel.toFixed(0)}`;
    const situ =
      cs.status !== 'playing'
        ? `<span class="bad">${STATUS_ZH[cs.status] ?? cs.status}</span>`
        : cs.warWith
          ? `<span class="bad">⚔️ ${getCountry(cs.warWith).nameZh}</span>`
          : '和平';
    return `<tr class="${isMe ? 'me' : ''}">
      <td>${i + 1}</td><td>${c.flag} ${c.nameZh}</td><td>${GOV_LABELS[cs.govType]}</td>
      <td>${fmtMoneyShort(cs.gdp)}</td><td class="v ${relTone}">${relTxt}</td><td>${situ}</td>
      <td class="v">${cs.score.toFixed(0)}</td></tr>`;
  }).join('');

  return `<div class="worldview">
    <section class="worldnews group"><h3>世界新闻 · ${me.year} 年</h3><ul>${news}</ul></section>
    <section class="worldtable group"><h3>列国 · 按 GDP 排名</h3>
      <table class="nations">
        <thead><tr><th>#</th><th>国家</th><th>政体</th><th>GDP</th><th>对你</th><th>态势</th><th>评分</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </div>`;
}
