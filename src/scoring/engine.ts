/**
 * AIdeology v1 scoring & discrimination engine.
 *
 * Implements the frozen product rules in src/content/frozen/scoring_spec_v1.json:
 *   1. axis scores  = mean(item semantic score / 2)          -> [-1, 1]
 *   2. AxisFit      = neutral-baseline-adjusted prototype fit
 *   3. DiscEvidence = 50 + 50 * mean(relevant adaptive evidence)
 *   4. Hallmark     = PASS 100 / PARTIAL 50 / FAIL 0
 *   5. RawFit       = .50 AxisFit + .30 DiscEvidence + .15 Hallmark + .05 Consistency
 *      FinalFit     = clamp(RawFit - contradiction penalty, 0, 100)
 *   6. result type  = single / primary+resonance / dual-core / mixed / low-information
 *   7. normalism meta-prototype, hidden badges, three confidence readings.
 *
 * Where the frozen pack leaves a rule unspecified, the choice made here is
 * recorded in docs/DECISIONS.md and marked "CHOICE" below.
 */
import {
  adaptiveById, adaptiveItemIdsFor, adaptiveItems, coreById, coreItems, hiddenItems,
  hiddenRules, ideologyByName, ideologies, prototypeRules, scoringSpec,
} from '../content';
import { ALL_AXES } from '../content/types';
import type {
  AxisId, ContradictionCondition, CoreItem, HallmarkCondition,
  HiddenRule, PrototypeRule,
} from '../content/types';

export type HallmarkStatus = 'PASS' | 'PARTIAL' | 'FAIL';
export type ResultType = 'single_primary' | 'primary_plus_resonance' | 'dual_core' | 'mixed' | 'low_information';
export type ConfidenceLabel = '高' | '中' | '低';

export interface SessionAnswers {
  core: Record<string, number>;      // itemId -> option index
  adaptive: Record<string, number>;
  hidden: Record<string, number>;
}

export interface ItemScore {
  item: CoreItem;
  optionIndex: number;
  raw: number;      // -2..+2
  normalized: number; // -1..1
}

export interface HallmarkResult {
  status: HallmarkStatus;
  score: number;
  hits: string[];
  misses: string[];
  adaptiveAsked: boolean;
  adaptiveRequiredHit: boolean;
}

export interface ContraHit {
  label: string;
  severity: 'medium' | 'strong';
}

export interface ProtoScore {
  slug: string;
  id: number;
  code: string;
  nameZh: string;
  axisFit: number;
  discEvidence: number;
  hallmark: HallmarkResult;
  consistency: number;
  penalty: number;
  rawFit: number;
  finalFit: number;
}

export interface Confidence {
  identity: { value: number; label: ConfidenceLabel };
  discrimination: { value: number; label: ConfidenceLabel };
  measurement: { value: number; label: ConfidenceLabel };
}

export interface HiddenBadge {
  id: string;
  nameZh: string;
  nameEn: string;
  summary: string;
  keywords: string[];
  strength: number;
  reasons: string[];
}

export interface ResultPackage {
  type: ResultType;
  axes: Partial<Record<AxisId, number>>;
  primary: ProtoScore | null;
  resonance: ProtoScore[];
  dual: ProtoScore[];
  scores: ProtoScore[];
  confidence: Confidence;
  hidden: HiddenBadge[];
  normalism: { passed: boolean; tagOnly: boolean };
  meta: {
    answeredCore: number;
    totalCore: number;
    midRate: number;
    meanAbsAxis: number;
    topGap: number;
    answeredAdaptive: number;
    consistency: number;
  };
  beliefTags: { axis: string; left: string; right: string; value: number; label: string }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/* ---------- 1. axis scores ---------- */

export function scoreItems(answers: SessionAnswers): Map<string, ItemScore> {
  const out = new Map<string, ItemScore>();
  for (const item of coreItems) {
    const idx = answers.core[item.id];
    if (idx === undefined || idx === null) continue;
    const opt = item.options[idx];
    if (!opt) continue;
    out.set(item.id, { item, optionIndex: idx, raw: opt.score, normalized: opt.score / 2 });
  }
  return out;
}

export function axisScores(scores: Map<string, ItemScore>): Partial<Record<AxisId, number>> {
  const sums = new Map<AxisId, { sum: number; n: number }>();
  for (const s of scores.values()) {
    const a = s.item.axis;
    const rec = sums.get(a) ?? { sum: 0, n: 0 };
    rec.sum += s.normalized;
    rec.n += 1;
    sums.set(a, rec);
  }
  const out: Partial<Record<AxisId, number>> = {};
  for (const a of ALL_AXES) {
    const rec = sums.get(a);
    // CHOICE: unanswered axis -> neutral 0 (answered-only mean).
    out[a] = rec && rec.n ? rec.sum / rec.n : 0;
  }
  return out;
}

/* ---------- 2. AxisFit (neutral-baseline adjusted) ---------- */

export function axisFit(user: Partial<Record<AxisId, number>>, rule: PrototypeRule): number {
  const targets = rule.axis_targets;
  let sumW = 0;
  let sumWA = 0;
  let sumWAmax = 0;
  for (const key of Object.keys(targets) as AxisId[]) {
    const t = targets[key]!;
    const u = user[key] ?? 0;
    const w = Math.abs(t);
    if (w === 0) continue;
    const s = 1 - Math.abs(u - t) / 2;
    const b = 1 - Math.abs(t) / 2;
    const a = s - b;
    sumW += w;
    sumWA += w * a;
    sumWAmax += w * (w / 2);
  }
  if (sumW === 0) return 50;
  const A = sumWA / sumW;
  const Amax = sumWAmax / sumW;
  const fit = A >= 0
    ? 50 + 50 * A / (Amax || 1)
    : 50 + 50 * A / 0.5;
  return clamp(fit, 0, 100);
}

/* ---------- 3. adaptive evidence ---------- */

export function relevantEvidence(slug: string, answers: SessionAnswers): number[] {
  const out: number[] = [];
  for (const item of adaptiveItems) {
    const idx = answers.adaptive[item.id];
    if (idx === undefined || idx === null) continue;
    const opt = item.options[idx];
    if (!opt) continue;
    const isA = ideologyByName.get(item.target_a)?.slug === slug;
    const isB = ideologyByName.get(item.target_b)?.slug === slug;
    if (isA) out.push(opt.evidence_a);
    else if (isB) out.push(opt.evidence_b);
  }
  return out;
}

export function discEvidence(slug: string, answers: SessionAnswers): number {
  const ev = relevantEvidence(slug, answers);
  if (!ev.length) return 50; // no_relevant_items -> 50 (and lowers discrimination confidence)
  const mean = ev.reduce((a, b) => a + b, 0) / ev.length;
  return clamp(50 + 50 * mean, 0, 100);
}

/* ---------- 4. Hallmark ---------- */

function axisOp(axes: Partial<Record<AxisId, number>>, axis: AxisId, op: string, value: number): boolean {
  const v = axes[axis] ?? 0;
  return op === '>=' ? v >= value : v <= value;
}

export function evaluateHallmark(
  rule: PrototypeRule,
  axes: Partial<Record<AxisId, number>>,
  scores: Map<string, ItemScore>,
  answers: SessionAnswers,
): HallmarkResult {
  const hits: string[] = [];
  const misses: string[] = [];
  let adaptiveAsked = true;
  let adaptiveRequiredHit = true;

  const adaptiveIndexFor = (itemId: string) => answers.adaptive[itemId];
  const evidenceOf = (itemId: string, favor: 'self' | 'opponent') => {
    const item = adaptiveById.get(itemId);
    const idx = adaptiveIndexFor(itemId);
    if (!item || idx === undefined) return null;
    const opt = item.options[idx];
    if (!opt) return null;
    // "self" = evidence toward the prototype this rule belongs to.
    const owner = ideologyByName.get(item.target_a)?.slug === rule.id ? 'a' : 'b';
    const channel = favor === 'self' ? owner : (owner === 'a' ? 'b' : 'a');
    return channel === 'a' ? opt.evidence_a : opt.evidence_b;
  };

  for (const cond of rule.hallmarks as HallmarkCondition[]) {
    let hit = false;
    switch (cond.type) {
      case 'axis':
        hit = axisOp(axes, cond.axis, cond.op, cond.value);
        break;
      case 'axis_range': {
        const v = axes[cond.axis] ?? 0;
        hit = v >= cond.min && (cond.max === undefined || v <= cond.max);
        break;
      }
      case 'count_item': {
        let n = 0;
        for (const id of cond.items) {
          const s = scores.get(id);
          if (!s) continue;
          // middle 0 is never evidence
          if (cond.score_op === '>=' ? s.raw >= cond.score : s.raw <= cond.score) n += 1;
        }
        hit = n >= cond.count;
        break;
      }
      case 'item_any': {
        hit = cond.items.some((id) => {
          const s = scores.get(id);
          return !!s && cond.scores.includes(s.raw);
        });
        break;
      }
      case 'adaptive_required': {
        const anyAsked = cond.items.some((id) => adaptiveIndexFor(id) !== undefined);
        if (!anyAsked) {
          adaptiveAsked = false;
          adaptiveRequiredHit = false;
          hit = false;
        } else {
          hit = cond.items.some((id) => {
            const e = evidenceOf(id, cond.favor);
            return e !== null && (cond.favor === 'self' ? e >= cond.threshold : -e >= cond.threshold);
          });
          if (!hit) adaptiveRequiredHit = false;
        }
        break;
      }
      case 'adaptive_optional': {
        hit = cond.items.some((id) => {
          const e = evidenceOf(id, cond.favor);
          return e !== null && (cond.favor === 'self' ? e >= cond.threshold : -e >= cond.threshold);
        });
        break;
      }
    }
    (hit ? hits : misses).push(cond.label);
  }

  const minSources = rule.hallmark_policy?.minimum_independent_sources ?? 2;
  let status: HallmarkStatus;
  if (hits.length === 0) status = 'FAIL';
  else if (hits.length >= minSources && adaptiveAsked) status = 'PASS';
  else status = 'PARTIAL';

  const scoreMap: Record<HallmarkStatus, number> = { PASS: 100, PARTIAL: 50, FAIL: 0 };
  return { status, score: scoreMap[status], hits, misses, adaptiveAsked, adaptiveRequiredHit };
}

/* ---------- 5. contradictions ---------- */

function axisPairHit(axes: Partial<Record<AxisId, number>>, conds: [AxisId, string, number][]): boolean {
  return conds.every(([axis, op, value]) => axisOp(axes, axis, op, value));
}

export function contradictions(
  rule: PrototypeRule,
  axes: Partial<Record<AxisId, number>>,
  answers: SessionAnswers,
): { hits: ContraHit[]; penalty: number } {
  const hits: ContraHit[] = [];
  for (const c of rule.contradictions as ContradictionCondition[]) {
    let hit = false;
    if (c.type === 'axis') hit = axisOp(axes, c.axis, c.op, c.value);
    else if (c.type === 'axis_pair') hit = axisPairHit(axes, c.conditions);
    else if (c.type === 'adaptive') {
      for (const id of c.items) {
        const item = adaptiveById.get(id);
        const idx = answers.adaptive[id];
        if (!item || idx === undefined) continue;
        const opt = item.options[idx];
        if (!opt) continue;
        const owner = ideologyByName.get(item.target_a)?.slug === rule.id ? 'a' : 'b';
        const channel = c.favor === 'self' ? owner : (owner === 'a' ? 'b' : 'a');
        const e = channel === 'a' ? opt.evidence_a : opt.evidence_b;
        if (-e >= c.threshold) { hit = true; break; }
      }
    }
    if (hit) hits.push({ label: c.label, severity: c.severity });
  }
  // CHOICE: overlapping contradiction signals are not independent; apply the
  // single strongest penalty rather than summing (spec is silent).
  const penalty = hits.reduce((m, h) => Math.max(m, h.severity === 'strong' ? 25 : 10), 0);
  return { hits, penalty };
}

/* ---------- 6. consistency ---------- */

export function consistency(scores: Map<string, ItemScore>): number {
  // CHOICE: spec fixes the 0.05 weight but not the formula. Use cross-item
  // agreement within each axis with >= 2 answered items: 1 - mean abs deviation.
  const byAxis = new Map<AxisId, number[]>();
  for (const s of scores.values()) {
    const arr = byAxis.get(s.item.axis) ?? [];
    arr.push(s.normalized);
    byAxis.set(s.item.axis, arr);
  }
  const vals: number[] = [];
  for (const arr of byAxis.values()) {
    if (arr.length < 2) continue;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const mad = arr.reduce((a, b) => a + Math.abs(b - mean), 0) / arr.length;
    vals.push(clamp(1 - mad, 0, 1));
  }
  if (!vals.length) return 50;
  return (vals.reduce((a, b) => a + b, 0) / vals.length) * 100;
}

/* ---------- 7. adaptive item selection ---------- */

export interface AdaptivePlan {
  itemIds: string[];
  candidates: string[];
}

export function planAdaptive(userAxes: Partial<Record<AxisId, number>>): AdaptivePlan {
  const fit = (slug: string) => axisFit(userAxes, prototypeRules.find((r) => r.id === slug)!);

  // CHOICE: spec gives the 6-10 range and the union mechanism, not a top-N.
  // Take top 8 prototypes by AxisFit as the candidate neighbourhood, plus the
  // frozen forced route for transhumanism (V3/V8 pattern) and normalism's meta
  // gate; then rank their union of adaptive items and keep 6-10.
  const competing = prototypeRules.filter((r) => r.id !== 'normalism');
  const ranked = [...competing].sort((a, b) => fit(b.id) - fit(a.id));
  const candidates = ranked.slice(0, 8).map((r) => r.id);

  const v3 = userAxes.V3 ?? 0;
  const v8 = userAxes.V8 ?? 0;
  if (fit('transhumanism') >= fit(candidates[candidates.length - 1]) - 6 && v3 >= 0.05 && v8 <= 0.4
      && !candidates.includes('transhumanism')) {
    candidates.push('transhumanism');
  }
  if ((userAxes.M1 ?? 0) <= -0.35 && !candidates.includes('normalism')) candidates.push('normalism');

  const pool = new Map<string, number>();
  for (const slug of candidates) {
    // Linkage comes from the adaptive bank's own target declarations (v1.1
    // replaced five pairs, so the frozen rule lists are stale).
    for (const id of adaptiveItemIdsFor(slug)) {
      pool.set(id, (pool.get(id) ?? 0) + 1);
    }
  }
  const items = [...pool.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([id]) => id);

  // Guarantee adaptive_required items of the top candidates are asked.
  const required: string[] = [];
  for (const r of ranked.slice(0, 3)) {
    for (const cond of r.hallmarks) {
      if (cond.type === 'adaptive_required') required.push(...cond.items);
    }
  }
  const ordered = [...new Set([...required, ...items])];
  const chosen = ordered.slice(0, Math.min(10, Math.max(6, ordered.length)));
  return { itemIds: chosen, candidates };
}

/* ---------- 8. hidden badges ---------- */

function strongCoreCount(axis: AxisId, minAbs: number, direction: string, count: number, scores: Map<string, ItemScore>): boolean {
  const dir = direction === 'positive' ? 1 : -1;
  let n = 0;
  for (const s of scores.values()) {
    if (s.item.axis !== axis) continue;
    if (dir * s.raw >= minAbs) n += 1;
  }
  return n >= count;
}

export function evaluateHidden(
  axes: Partial<Record<AxisId, number>>,
  scores: Map<string, ItemScore>,
  scoreList: ProtoScore[],
  answers: SessionAnswers,
): HiddenBadge[] {
  const triggered: HiddenBadge[] = [];
  const hallmarkOf = (slug: string) => scoreList.find((s) => s.slug === slug)?.hallmark.status ?? 'FAIL';

  for (const rule of hiddenRules) {
    const pre = rule.prerequisites as Record<string, any>;
    let met = true;
    const reasons: string[] = [];

    for (const [key, val] of Object.entries(pre)) {
      if (key === 'prototype') continue;
      if (key === 'prototype_fit_min') continue;
      if (val && typeof val === 'object' && 'min' in val) {
        if ((axes[key as AxisId] ?? 0) >= val.min) reasons.push(`${key} ≥ ${val.min}`); else met = false;
      } else if (val && typeof val === 'object' && 'max' in val) {
        if ((axes[key as AxisId] ?? 0) <= val.max) reasons.push(`${key} ≤ ${val.max}`); else met = false;
      } else if (val && typeof val === 'object' && 'count' in val) {
        if (strongCoreCount(val.axis, val.min_raw_abs, val.direction, val.count, scores)) {
          reasons.push(`${val.axis} 强取向 ≥ ${val.count} 题`);
        } else met = false;
      }
    }
    if (pre.prototype) {
      if ((scoreList.find((s) => s.slug === pre.prototype)?.finalFit ?? 0) >= Number(pre.prototype_fit_min ?? 0)) {
        reasons.push(`原型 ${pre.prototype} 达标`);
      } else met = false;
    }
    if (!met) continue;

    // guards
    if (rule.id === 'machine-emancipation' && hallmarkOf('digital-life') !== 'PASS') continue;
    if (rule.id === 'algorithmic-paternalism' && hallmarkOf('algorithmic-opt') !== 'PASS') continue;

    // trigger: both topic items >= +1, at least one == +2
    let sum = 0;
    let strong = 0;
    let n = 0;
    for (const id of rule.items) {
      const idx = answers.hidden[id];
      const item = hiddenItems.find((h) => h.id === id);
      if (idx === undefined || !item) continue;
      const opt = item.options[idx];
      if (!opt) continue;
      n += 1;
      sum += opt.score;
      reasons.push(`${id} ${opt.score >= 0 ? '+' : ''}${opt.score}`);
      if (opt.score >= 1) { /* obvious support */ }
      if (opt.score === 2) strong += 1;
    }
    const allObvious = rule.items.every((id) => {
      const idx = answers.hidden[id];
      const item = hiddenItems.find((h) => h.id === id);
      if (idx === undefined || !item) return false;
      return (item.options[idx]?.score ?? -99) >= 1;
    });
    if (!(allObvious && strong >= 1)) continue;

    const copy = hintFor(rule);
    triggered.push({
      id: rule.id,
      nameZh: rule.name,
      nameEn: copy.nameEn,
      summary: copy.summary,
      keywords: copy.keywords,
      strength: sum + n * 0.01,
      reasons,
    });
  }

  // CHOICE: rank by specificity (prerequisite count) then evidence strength;
  // cap at max_badges (2).
  triggered.sort((a, b) => (b.strength - a.strength));
  return triggered.slice(0, scoringSpec.hidden?.max_badges ?? 2);
}

import { hiddenCopyById as hiddenCopyMap } from '../content';
function hintFor(rule: HiddenRule) {
  const c = hiddenCopyMap.get(rule.id);
  return {
    nameEn: c?.nameEn ?? rule.name,
    summary: c?.summary ?? '',
    keywords: c?.keywords ?? [],
  };
}

/* ---------- 9. normalism meta-prototype ---------- */

export function evaluateNormalism(
  axes: Partial<Record<AxisId, number>>,
  scores: Map<string, ItemScore>,
  answers: SessionAnswers,
  scoreList: ProtoScore[],
): { passed: boolean; tagOnly: boolean } {
  const m1 = axes.M1 ?? 0;
  if (m1 > -0.4) return { passed: false, tagOnly: false };

  // M1 three items: at least 2 explicit normalcy (raw <= -1)
  let m1Normal = 0;
  for (const s of scores.values()) {
    if (s.item.axis !== 'M1') continue;
    if (s.raw <= -1) m1Normal += 1;
  }
  if (m1Normal < 2) return { passed: false, tagOnly: false };

  // A22 if answered must not strongly reject normalism (evidence_a is pro-normalism)
  const a22idx = answers.adaptive.A22;
  if (a22idx !== undefined) {
    const item = adaptiveById.get('A22');
    const opt = item?.options[a22idx];
    if (opt && opt.evidence_a <= -0.5) return { passed: false, tagOnly: false };
  }

  const othersHigh = scoreList.some((s) => s.slug !== 'normalism' && s.finalFit >= 70);
  if (othersHigh) return { passed: false, tagOnly: true };
  return { passed: true, tagOnly: false };
}

/* ---------- 10. selection ---------- */

function confidenceLabels(primaryFit: number, gap: number, coverage: number, consistencyVal: number): Confidence {
  const label = (v: number, hi: number, mid: number): ConfidenceLabel => (v >= hi ? '高' : v >= mid ? '中' : '低');
  const identityVal = clamp(primaryFit, 0, 100);
  const discVal = clamp((gap / 15) * 100, 0, 100);
  const measVal = clamp(coverage * 60 + consistencyVal * 0.4, 0, 100);
  return {
    identity: { value: round1(identityVal), label: label(identityVal, 78, 64) },
    discrimination: { value: round1(discVal), label: label(gap, 10, 6) },
    measurement: { value: round1(measVal), label: label(measVal, 78, 55) },
  };
}

/* ---------- 11. belief tags (B1-B6) ---------- */

function beliefTags(axes: Partial<Record<AxisId, number>>) {
  // CHOICE: the frozen pack declares B1-B6 as an independent module but ships
  // no items or formula. We surface only what the frozen axes can honestly
  // support (X3 -> time ethics) and leave the rest out rather than invent it.
  const x3 = axes.X3 ?? 0;
  return [
    { axis: 'X3', left: '当代优先', right: '长期主义', value: round1(x3), label: x3 >= 0.2 ? '长期主义倾向' : x3 <= -0.2 ? '当代优先倾向' : '均衡' },
  ];
}

/* ---------- main ---------- */

export function computeResult(answers: SessionAnswers): ResultPackage {
  const scores = scoreItems(answers);
  const axes = axisScores(scores);
  const cons = consistency(scores);

  const scoreList: ProtoScore[] = prototypeRules.map((rule) => {
    const ideology = ideologies.find((i) => i.slug === rule.id)!;
    const af = axisFit(axes, rule);
    const de = discEvidence(rule.id, answers);
    const hm = evaluateHallmark(rule, axes, scores, answers);
    const { penalty } = contradictions(rule, axes, answers);
    const rawFit = 0.5 * af + 0.3 * de + 0.15 * hm.score + 0.05 * cons;
    const finalFit = clamp(rawFit - penalty, 0, 100);
    return {
      slug: rule.id,
      id: ideology.id,
      code: ideology.code,
      nameZh: ideology.copy.nameZh,
      axisFit: round1(af),
      discEvidence: round1(de),
      hallmark: hm,
      consistency: round1(cons),
      penalty,
      rawFit: round1(rawFit),
      finalFit: round1(finalFit),
    };
  }).sort((a, b) => (b.finalFit - a.finalFit) || (a.id - b.id));

  const answeredCore = scores.size;
  const totalCore = coreItems.length;
  const midCount = [...scores.values()].filter((s) => s.raw === 0).length;
  const midRate = answeredCore ? midCount / answeredCore : 0;
  const axisVals = ALL_AXES.filter((a) => a !== 'M1').map((a) => Math.abs(axes[a] ?? 0));
  const meanAbsAxis = axisVals.length ? axisVals.reduce((a, b) => a + b, 0) / axisVals.length : 0;
  const top1 = scoreList[0];
  const top2 = scoreList[1];
  const topGap = top1 && top2 ? top1.finalFit - top2.finalFit : 0;

  const li = scoringSpec.low_information;
  const isLowInfo = midRate >= li.mid_rate_min && meanAbsAxis < li.mean_abs_axis_max && topGap < li.top_gap_max;

  const sel = scoringSpec.selection;
  let type: ResultType;
  let primary: ProtoScore | null = null;
  let resonance: ProtoScore[] = [];
  let dual: ProtoScore[] = [];

  const normalism = evaluateNormalism(axes, scores, answers, scoreList);
  const normalismScore = scoreList.find((s) => s.slug === 'normalism')!;

  if (isLowInfo) {
    type = 'low_information';
  } else if (top1.finalFit >= sel.dual_core_min_fit && topGap <= sel.dual_core_gap_max
      && top1.hallmark.status === 'PASS' && top2.hallmark.status === 'PASS') {
    type = 'dual_core';
    dual = [top1, top2];
    primary = top1;
  } else if (top1.finalFit >= sel.primary_min) {
    if (topGap <= 5) {
      type = 'mixed';
      primary = top1;
      resonance = scoreList.slice(1).filter((s) => s.finalFit >= sel.resonance_min).slice(0, 3);
    } else if (topGap >= sel.clear_gap) {
      type = 'single_primary';
      primary = top1;
      resonance = scoreList.slice(1).filter((s) => s.finalFit >= sel.resonance_min).slice(0, 3);
    } else {
      type = 'primary_plus_resonance';
      primary = top1;
      resonance = scoreList.slice(1).filter((s) => s.finalFit >= sel.resonance_min).slice(0, 3);
    }
  } else {
    // top1 below primary_min -> no confident primary
    type = top1.finalFit >= sel.resonance_min ? 'mixed' : 'low_information';
    if (type === 'mixed') {
      primary = top1;
      resonance = scoreList.slice(1).filter((s) => s.finalFit >= sel.resonance_min).slice(0, 3);
    }
  }

  if (normalism.passed && type !== 'low_information') {
    // normalism becomes the primary via meta-fallback
    type = 'single_primary';
    primary = normalismScore;
    resonance = scoreList.filter((s) => s.slug !== 'normalism' && s.finalFit >= sel.resonance_min).slice(0, 3);
  }

  const hidden = evaluateHidden(axes, scores, scoreList, answers);
  const coverage = totalCore ? answeredCore / totalCore : 0;
  const primaryFit = primary?.finalFit ?? top1.finalFit;
  const confidence = confidenceLabels(primaryFit, topGap, coverage, cons);
  if (scores.size && !answers.adaptive || Object.keys(answers.adaptive).length === 0) {
    confidence.discrimination = { value: 0, label: '低' };
    confidence.discrimination.value = round1(clamp((topGap / 15) * 100, 0, 100));
  }

  return {
    type,
    axes,
    primary,
    resonance,
    dual,
    scores: scoreList,
    confidence,
    hidden,
    normalism,
    meta: {
      answeredCore,
      totalCore,
      midRate: round1(midRate * 100) / 100,
      meanAbsAxis: round1(meanAbsAxis * 100) / 100,
      topGap: round1(topGap),
      answeredAdaptive: Object.keys(answers.adaptive).length,
      consistency: round1(cons),
    },
    beliefTags: beliefTags(axes),
  };
}

export function emptyAnswers(): SessionAnswers {
  return { core: {}, adaptive: {}, hidden: {} };
}

export const RESULT_TYPE_LABEL: Record<ResultType, string> = {
  single_primary: '主意识形态',
  primary_plus_resonance: '主意识形态 + 共鸣',
  dual_core: '双核心',
  mixed: '混合型',
  low_information: '未定型',
};

export type { ProtoScore as ProtoScoreType, HiddenRule };
export { coreById, adaptiveById };
