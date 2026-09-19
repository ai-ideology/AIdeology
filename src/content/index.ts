/**
 * Content layer. Everything the app renders or scores from is loaded here, so
 * copy and question banks stay configurable (edit the JSON, not the code).
 */
import coreItemsJson from './frozen/core_items_v1.1.json';
import adaptiveItemsJson from './frozen/adaptive_items_v1.1.json';
import hiddenItemsJson from './frozen/hidden_items_v1.json';
import prototypeRulesJson from './frozen/prototype_rules_v1.json';
import hiddenRulesJson from './frozen/hidden_rules_v1.json';
import dimensionsJson from './frozen/dimensions_v1.json';
import scoringSpecJson from './frozen/scoring_spec_v1.json';
import familiesJson from './families.json';
import ideologiesJson from './ideologies.json';
import detailCopyJson from './detail-copy.json';
import axisCopyJson from './axis-copy.json';
import ideologyProfilesJson from './ideology-profiles.json';
import relationsJson from './relations.json';
import siteJson from './site.json';

import type {
  AdaptiveItem, AxisCopy, AxisId, CoreItem, Dimension, Family, HiddenCopy, HiddenItem,
  HiddenRule, IdeologyCopy, IdeologyProfile, PrototypeRule, RelationPair, RelationType,
} from './types';
import { ALL_AXES, CORE_AXES, EXTENDED_AXES } from './types';

export const coreItems = coreItemsJson as unknown as CoreItem[];
export const adaptiveItems = adaptiveItemsJson as unknown as AdaptiveItem[];
export const hiddenItems = hiddenItemsJson as unknown as HiddenItem[];
export const prototypeRules = prototypeRulesJson as unknown as PrototypeRule[];
export const hiddenRules = hiddenRulesJson as unknown as HiddenRule[];
export const dimensions = dimensionsJson as unknown as Dimension[];
export const scoringSpec = scoringSpecJson as unknown as Record<string, any>;
export const families = familiesJson as unknown as Family[];
export const ideologyCopy = ideologiesJson.ideologies as unknown as IdeologyCopy[];
export const hiddenCopy = ideologiesJson.hidden as unknown as HiddenCopy[];
export const axisCopyById = axisCopyJson as unknown as Record<AxisId, AxisCopy>;
export const profileBySlug = ideologyProfilesJson as unknown as Record<string, IdeologyProfile>;
export const relations = relationsJson as unknown as RelationPair[];

/**
 * Brand copy shown outside the test: the footer slogan and the share card.
 * Kept in one file so the two render sites cannot drift apart (they used to
 * hard-code the same sentence separately).
 */
export const siteCopy = siteJson as unknown as { sloganZh: string; sloganEn: string; wordmark: string };

/** Relation copy keyed by an order-independent slug pair. */
const relationKey = (a: string, b: string) => [a, b].sort().join('|');
export const relationByPair = new Map(relations.map((r) => [relationKey(r.pair[0], r.pair[1]), r]));
export function relationFor(a: string, b: string): RelationPair | undefined {
  return relationByPair.get(relationKey(a, b));
}

/* ---------- degree comparator (v1.1 §9) ---------- */

export type DegreeBand = 'equal' | 'slightly' | 'clearly' | 'far';
export interface DegreeComparison {
  axis: AxisId;
  /** User's own position on the axis, −1..1. */
  user: number;
  /** The comparator prototype's frozen axis target, −1..1. */
  prototype: number;
  delta: number;
  band: DegreeBand;
  /** Who is further along, or null when the gap is negligible. */
  stronger: 'user' | 'other' | null;
  /** Whether the prototype treats this axis as one of its own concerns. */
  relevant: boolean;
}

/** Front-end degree bands from the doc (product thresholds, pilot-calibratable). */
export function degreeBand(absDelta: number): DegreeBand {
  if (absDelta < 0.15) return 'equal';
  if (absDelta < 0.35) return 'slightly';
  if (absDelta < 0.65) return 'clearly';
  return 'far';
}

export const DEGREE_BAND_LABEL: Record<DegreeBand, string> = {
  equal: '几乎同样强',
  slightly: '略强一些',
  clearly: '明显更强',
  far: '走得远得多',
};

/**
 * Compare the user's real axis position against a prototype's frozen target.
 * `relevant` follows the doc's §9.2 rule: if the prototype does not treat this
 * axis as its own concern, the caller must fall back to priority_difference
 * rather than claim "it is more/less X".
 */
export function compareDegree(
  axis: AxisId, userValue: number, other: Ideology, relevanceMin = 0.3,
): DegreeComparison {
  const prototype = other.rule.axis_targets[axis] ?? 0;
  const delta = userValue - prototype;
  const abs = Math.abs(delta);
  return {
    axis,
    user: userValue,
    prototype,
    delta,
    band: degreeBand(abs),
    stronger: abs < 0.15 ? null : delta > 0 ? 'user' : 'other',
    relevant: Math.abs(prototype) >= relevanceMin,
  };
}

/** Which of the five front-end bands a raw axis score falls into. */
export function axisBand(v: number): keyof AxisCopy['bands'] {
  if (v < -0.65) return 'strong_left';
  if (v < -0.25) return 'left';
  if (v <= 0.25) return 'center';
  if (v <= 0.65) return 'right';
  return 'strong_right';
}

/** Trim trailing Chinese/ASCII sentence punctuation before joining clauses. */
export function trimPunct(s: string): string {
  return s.replace(/[。；;，,．.\s]+$/, '');
}

/** A concrete, second-person stance sentence for the user's own axis score. */
export function userStance(axisId: AxisId, value: number): string {
  const copy = axisCopyById[axisId];
  return copy ? copy.bands[axisBand(value)] : '';
}

/** The concrete position a prototype takes on an axis (whose side + definition). */
export function ideologyStance(axisId: AxisId, value: number): { lean: string; text: string; positive: boolean } {
  const copy = axisCopyById[axisId];
  if (!copy) return { lean: '', text: '', positive: value >= 0 };
  const positive = value >= 0;
  const side = positive ? copy.right : copy.left;
  return { lean: side.label, text: side.definition, positive };
}

/**
 * "你认为……，而「X」认为……" — the concrete two-sided contrast on one axis.
 * Used by the comparison panel so it states positions instead of asking the
 * axis question back at the reader.
 */
export function versusStance(axisId: AxisId, userValue: number, otherValue: number, otherName: string): string {
  const mine = trimPunct(userStance(axisId, userValue));
  const theirs = trimPunct(ideologyStance(axisId, otherValue).text);
  if (!mine || !theirs) return '';
  return `${mine}；而「${otherName}」认为：${theirs}。`;
}

/** A prototype takes a real position on an axis only when |target| is non-trivial. */
export const AXIS_POSITION_MIN = 0.15;
const POSITION_MIN = AXIS_POSITION_MIN;

/** Where two positions agree on an axis, stated as a shared concrete claim. */
export function sharedStance(axisId: AxisId, userValue: number, otherValue: number, otherName: string): string {
  const copy = axisCopyById[axisId];
  if (!copy) return '';
  const sameSide = Math.abs(userValue) >= POSITION_MIN && Math.abs(otherValue) >= POSITION_MIN
    && Math.sign(userValue) === Math.sign(otherValue);
  if (sameSide) {
    const side = userValue >= 0 ? copy.right : copy.left;
    return `你们都站在「${side.label}」这一边：${trimPunct(side.definition)}。`;
  }
  // No shared pole: state the reader's own answer and whether the other side
  // actually contests it — never a hollow "判断最接近".
  const mine = trimPunct(userStance(axisId, userValue));
  if (!mine) return '';
  return Math.abs(otherValue) >= POSITION_MIN
    ? `在「${copy.plain}」上，${mine}；「${otherName}」的回答也没有站在对面。`
    : `在「${copy.plain}」上，${mine}；而「${otherName}」在这里没有强烈立场。`;
}

/**
 * The concrete boundary between the user and a prototype on one axis, phrased
 * from both sides (never "差异明显"). Handles opposite camps and, when both sit
 * on the same pole, says directly who is the stronger one.
 *
 * `brief` omits the prototype's pole definition when the caller has already
 * stated it (the resonance panel shows it in 「为什么相近」), leaving only the
 * degree verdict so the two columns do not repeat the same sentence.
 */
export function boundaryStance(
  axisId: AxisId, userValue: number, other: Ideology, opts?: { brief?: boolean },
): string {
  const copy = axisCopyById[axisId];
  if (!copy) return '';
  const name = other.copy.nameZh;
  const otherValue = other.rule.axis_targets[axisId] ?? 0;
  const mine = trimPunct(userStance(axisId, userValue));
  if (!mine) return '';
  const uStrong = Math.abs(userValue) >= POSITION_MIN;
  const pStrong = Math.abs(otherValue) >= POSITION_MIN;

  if (!pStrong) return `在「${copy.plain}」上，${mine}；而「${name}」在这里没有强烈立场。`;
  const theirs = trimPunct(ideologyStance(axisId, otherValue).text);
  if (!uStrong) return `在「${copy.plain}」上，你没有强烈立场；「${name}」则明确主张：${theirs}。`;
  if (Math.sign(userValue) !== Math.sign(otherValue)) return `${mine}；而「${name}」认为：${theirs}。`;

  // Same pole: name who holds the stronger version (v1.1 §9 — no bars, just words).
  const delta = userValue - otherValue;
  if (Math.abs(delta) < POSITION_MIN) {
    return opts?.brief ? `${mine}；你们在这个方向上的程度接近。` : `${mine}；「${name}」的立场与你的程度接近：${theirs}。`;
  }
  const who = delta > 0 ? '你的立场更强' : `「${name}」的立场更强`;
  return opts?.brief ? `${mine}；${who}。` : `${mine}；${who}：${theirs}。`;
}

export interface DetailCopyItem { h: string; p: string }
export interface DetailCopy { items: DetailCopyItem[]; origin: string }
export const detailCopyBySlug = detailCopyJson.beliefs as unknown as Record<string, DetailCopy>;

export const coreById = new Map(coreItems.map((i) => [i.id, i]));
export const adaptiveById = new Map(adaptiveItems.map((i) => [i.id, i]));
export const hiddenById = new Map(hiddenItems.map((i) => [i.id, i]));
export const ruleById = new Map(prototypeRules.map((r) => [r.id, r]));
export const copyBySlug = new Map(ideologyCopy.map((c) => [c.slug, c]));
export const copyByName = new Map(ideologyCopy.map((c) => [c.nameZh, c]));
export const hiddenCopyById = new Map(hiddenCopy.map((c) => [c.id, c]));
export const dimensionById = new Map(dimensions.map((d) => [d.id, d]));

/** Rule + presentation copy joined, in stable IDEOLOGY_01..26 order. */
export interface Ideology {
  id: number;
  slug: string;
  code: string;
  rule: PrototypeRule;
  copy: IdeologyCopy;
}
export const ideologies: Ideology[] = ideologyCopy
  .map((copy) => {
    const rule = ruleById.get(copy.slug);
    if (!rule) throw new Error(`No prototype rule for slug ${copy.slug}`);
    return { id: copy.id, slug: copy.slug, code: copy.code, rule, copy };
  })
  .sort((a, b) => a.id - b.id);

export const ideologyBySlug = new Map(ideologies.map((x) => [x.slug, x]));
export const ideologyByCode = new Map(ideologies.map((x) => [x.code, x]));
export const ideologyByName = new Map(ideologies.map((x) => [x.copy.nameZh, x]));

/**
 * Prototype slug -> the adaptive items that discriminate it.
 *
 * v1.1 replaced five adaptive pairs (A11/A12/A21/A23/A24 -> *R), so the frozen
 * `adaptive_items` lists in `prototype_rules_v1.json` are stale. The bank owns
 * this linkage: every adaptive item declares its `target_a` / `target_b`, which
 * is already how `relevantEvidence` reads it. Deriving the map from the bank
 * keeps one source of truth and covers every prototype.
 */
export const adaptiveItemsByPrototype = new Map<string, string[]>(
  ideologies.map((x) => [x.slug, [] as string[]]),
);
for (const item of adaptiveItems) {
  for (const name of [item.target_a, item.target_b]) {
    const slug = ideologyByName.get(name)?.slug;
    if (slug) adaptiveItemsByPrototype.get(slug)!.push(item.id);
  }
}

export function adaptiveItemIdsFor(slug: string): string[] {
  return adaptiveItemsByPrototype.get(slug) ?? [];
}

/** Adaptive items relevant to a set of prototype slugs. */
export function adaptiveItemsFor(slugs: string[]): AdaptiveItem[] {
  const wanted = new Set<string>();
  for (const slug of slugs) {
    for (const id of adaptiveItemIdsFor(slug)) wanted.add(id);
  }
  return adaptiveItems.filter((i) => wanted.has(i.id));
}

export function familyZh(label: string): string {
  const f = families.find((x) => x.zh === label);
  return f ? f.zh : label;
}

export function familyOf(ideology: Ideology): Family | undefined {
  return families.find((f) => f.zh === ideology.copy.family);
}

export const VALID_AXIS = new Set<AxisId>(dimensions.map((d) => d.id));

/** L1 distance between two prototypes' axis targets. */
function targetDistance(a: Ideology, b: Ideology): number {
  const ax = a.rule.axis_targets;
  const bx = b.rule.axis_targets;
  const keys = new Set<AxisId>([...(Object.keys(ax) as AxisId[]), ...(Object.keys(bx) as AxisId[])]);
  let d = 0;
  for (const k of keys) d += Math.abs((ax[k] ?? 0) - (bx[k] ?? 0));
  return d;
}

export function nearestIdeologies(x: Ideology, n: number): Ideology[] {
  return ideologies
    .filter((y) => y.slug !== x.slug)
    .map((y) => ({ y, d: targetDistance(x, y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((o) => o.y);
}

/** Frozen-declared neighbors first, then distance fill. */
export function declaredNeighbors(x: Ideology, n: number): Ideology[] {
  const declared = x.rule.neighbors
    .map((name) => ideologyByName.get(name))
    .filter((v): v is Ideology => !!v && v.slug !== x.slug);
  if (declared.length >= n) return declared.slice(0, n);
  const seen = new Set(declared.map((d) => d.slug));
  for (const y of nearestIdeologies(x, n + 4)) {
    if (declared.length >= n) break;
    if (seen.has(y.slug)) continue;
    seen.add(y.slug);
    declared.push(y);
  }
  return declared.slice(0, n);
}

export function farthestIdeologies(x: Ideology, n: number): Ideology[] {
  return ideologies
    .filter((y) => y.slug !== x.slug)
    .map((y) => ({ y, d: targetDistance(x, y) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, n)
    .map((o) => o.y);
}

/** The axes where two prototypes differ most — used as the "key axes" chips. */
export function differingAxes(a: Ideology, b: Ideology, n: number): AxisId[] {
  return [...CORE_AXES, ...EXTENDED_AXES]
    .map((id) => ({ id, d: Math.abs((a.rule.axis_targets[id] ?? 0) - (b.rule.axis_targets[id] ?? 0)) }))
    .sort((x, y) => y.d - x.d)
    .slice(0, n)
    .map((o) => o.id);
}

/** The axes two prototypes agree on, strongest shared commitment first. */
export function sharedAxes(a: Ideology, b: Ideology, n: number): AxisId[] {
  return [...CORE_AXES, ...EXTENDED_AXES]
    .map((id) => {
      const av = a.rule.axis_targets[id] ?? 0;
      const bv = b.rule.axis_targets[id] ?? 0;
      const sameSide = av !== 0 && bv !== 0 && Math.sign(av) === Math.sign(bv);
      return { id, strength: sameSide ? Math.min(Math.abs(av), Math.abs(bv)) : 0 };
    })
    .filter((o) => o.strength > 0)
    .sort((x, y) => y.strength - x.strength)
    .slice(0, n)
    .map((o) => o.id);
}

/**
 * The axes where two prototypes are closest in value, regardless of direction.
 * Used as a fallback for resonance when the two share no same-side commitment —
 * "you answer these the most alike" is still the honest reading.
 */
export function closestAxes(a: Ideology, b: Ideology, n: number): AxisId[] {
  return [...CORE_AXES, ...EXTENDED_AXES]
    .map((id) => ({ id, d: Math.abs((a.rule.axis_targets[id] ?? 0) - (b.rule.axis_targets[id] ?? 0)) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((o) => o.id);
}

/** Key axes for a resonance panel: shared commitments, else closest answers. */
export function resonanceAxes(a: Ideology, b: Ideology, n: number): AxisId[] {
  const shared = sharedAxes(a, b, n);
  return shared.length ? shared : closestAxes(a, b, n);
}

/* ---------- user-centric axis selection ----------
 * The panel is about the READER, not about the primary prototype. Selecting the
 * axis from the frozen prototype vector (as `resonanceAxes`/`contrastingAxes`
 * do) can land on a question neither the user nor the other prototype has an
 * opinion about, which is what produced "判断最接近 / 差异明显" filler. These
 * variants rank the axes by the user's own answers. */

/** A sparse axis -> user score map. */
export type AxisValues = Partial<Record<AxisId, number>>;

/** Axes where the user and a prototype hold the same pole, strongest shared first. */
export function userSharedAxes(other: Ideology, axes: AxisValues, n: number): AxisId[] {
  return [...CORE_AXES, ...EXTENDED_AXES]
    .map((id) => {
      const u = axes[id] ?? 0;
      const p = other.rule.axis_targets[id] ?? 0;
      const same = u !== 0 && p !== 0 && Math.sign(u) === Math.sign(p);
      return { id, strength: same ? Math.min(Math.abs(u), Math.abs(p)) : 0 };
    })
    .filter((o) => o.strength > 0)
    .sort((x, y) => y.strength - x.strength)
    .slice(0, n)
    .map((o) => o.id);
}

/** Axes where the user and a prototype are numerically closest (no pole needed). */
export function userClosestAxes(other: Ideology, axes: AxisValues, n: number): AxisId[] {
  return [...CORE_AXES, ...EXTENDED_AXES]
    .map((id) => ({ id, d: Math.abs((axes[id] ?? 0) - (other.rule.axis_targets[id] ?? 0)) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((o) => o.id);
}

/** Resonance axes for the reader: shared poles, else the least-disputed answers. */
export function userResonanceAxes(other: Ideology, axes: AxisValues, n: number): AxisId[] {
  const shared = userSharedAxes(other, axes, n);
  return shared.length ? shared : userClosestAxes(other, axes, n);
}

/** Axes where the user's answer diverges most from a prototype it cares about. */
export function userContrastAxes(other: Ideology, axes: AxisValues, n: number, min = 0.3): AxisId[] {
  const ranked = [...CORE_AXES, ...EXTENDED_AXES]
    .map((id) => ({ id, d: Math.abs((axes[id] ?? 0) - (other.rule.axis_targets[id] ?? 0)) }))
    .sort((x, y) => y.d - x.d);
  const relevant = ranked.filter((o) => Math.abs(other.rule.axis_targets[o.id] ?? 0) >= min);
  return (relevant.length ? relevant : ranked).slice(0, n).map((o) => o.id);
}

/**
 * The axis a contrast should actually be argued on: the biggest gap, but only
 * where the comparator prototype holds a real position (|target| ≥ min). This
 * avoids "you differ on X" when X is simply not one of the other's concerns.
 */
export function contrastingAxes(a: Ideology, b: Ideology, n: number, min = 0.3): AxisId[] {
  const ranked = differingAxes(a, b, ALL_AXES.length);
  const relevant = ranked.filter((id) => Math.abs(b.rule.axis_targets[id] ?? 0) >= min);
  return (relevant.length ? relevant : ranked).slice(0, n);
}

/**
 * Judge the relation type from the user's real axes vs the prototype vector,
 * for pairs that have no hand-written copy (v1.1 §10.1 step 4). Keeps the
 * panel honest: a far-apart pair that never actually disagrees on an axis both
 * care about is reported as a priority difference, not a fake conflict.
 */
export function inferRelationType(axis: AxisId, userValue: number, other: Ideology): RelationType {
  const cmp = compareDegree(axis, userValue, other);
  const userSign = Math.sign(cmp.user);
  const protoSign = Math.sign(cmp.prototype);
  // Opposite camps: only when the prototype actually holds a position here.
  if (userSign !== 0 && protoSign !== 0 && userSign !== protoSign) return 'opposite_direction';
  // No real position on this axis -> it is not a degree contest (doc §9.2).
  if (!cmp.relevant) return 'priority_difference';
  if (cmp.band === 'far' || cmp.band === 'clearly') return 'same_direction_degree';
  return 'priority_difference';
}

/**
 * One-line teaser for a selector card. Must contain a comparison word, per the
 * v1.1 rule that a card never just states one side's view. When the reader's own
 * axes are supplied, the teaser reflects the pole the reader actually shares
 * (or splits on) instead of a generic "判断最接近".
 */
export function relationPreview(
  self: Ideology, other: Ideology, kind: 'resonance' | 'contrast', axes?: AxisValues,
): string {
  const manual = relationFor(self.slug, other.slug);
  const name = other.copy.nameZh;

  if (kind === 'resonance') {
    if (manual?.shared) return manual.shared;
    const axis = axes ? userResonanceAxes(other, axes, 1)[0] : sharedAxes(self, other, 1)[0];
    const copy = axis ? axisCopyById[axis] : undefined;
    if (!copy || !axis) return `你和「${name}」的整体价值排序很接近。`;
    const u = axes?.[axis] ?? self.rule.axis_targets[axis] ?? 0;
    const p = other.rule.axis_targets[axis] ?? 0;
    if (u !== 0 && p !== 0 && Math.sign(u) === Math.sign(p)) {
      const side = p >= 0 ? copy.right : copy.left;
      return `你们都站在「${side.label}」这一边。`;
    }
    return `你们在「${copy.plain}」上的判断最接近。`;
  }

  // contrast: lead with the relation type, then the axis both care about.
  const type = manual?.relationType;
  const axisId = manual?.keyAxis ?? (axes ? userContrastAxes(other, axes, 1)[0] : differingAxes(self, other, 1)[0]);
  const axis = axisId ? axisCopyById[axisId] : undefined;
  const topic = axis ? `「${axis.plain}」` : '整体价值排序';
  switch (type) {
    case 'same_direction_degree': return `你们都倾向${topic}，但有一方走得更远。`;
    case 'threshold_difference': return `你们原则接近，对${topic}的跨线门槛不同。`;
    case 'motive_difference': return `你们可能做出相近选择，但理由不同。`;
    case 'priority_difference': return `你们不一定对立，只是更优先的问题不同。`;
    case 'scope_difference': return `你们方向接近，只是适用的范围不同。`;
    case 'opposite_direction': return `你们在${topic}上站在两边。`;
  }
  if (axis && axisId) {
    const u = axes?.[axisId] ?? self.rule.axis_targets[axisId] ?? 0;
    const p = other.rule.axis_targets[axisId] ?? 0;
    if (u !== 0 && p !== 0 && Math.sign(u) !== Math.sign(p)) {
      return `你偏「${(u >= 0 ? axis.right : axis.left).label}」，它偏「${(p >= 0 ? axis.right : axis.left).label}」。`;
    }
  }
  return `你和「${name}」在${topic}上分歧最大。`;
}

if (import.meta.env?.DEV) {
  // Light integrity checks so misconfigured content fails loudly in dev.
  const errs: string[] = [];
  if (coreItems.length !== 48) errs.push(`core items = ${coreItems.length}, expected 48`);
  if (adaptiveItems.length !== 24) errs.push(`adaptive items = ${adaptiveItems.length}, expected 24`);
  if (hiddenItems.length !== 16) errs.push(`hidden items = ${hiddenItems.length}, expected 16`);
  if (prototypeRules.length !== 26) errs.push(`prototype rules = ${prototypeRules.length}, expected 26`);
  if (ideologies.length !== 26) errs.push(`ideologies = ${ideologies.length}, expected 26`);
  for (const r of prototypeRules) {
    if (!copyBySlug.has(r.id)) errs.push(`prototype ${r.id} has no presentation copy`);
  }
  for (const slug of copyBySlug.keys()) {
    if (!detailCopyBySlug[slug]) errs.push(`ideology ${slug} has no detail copy`);
  }
  if (errs.length) console.error('[content] integrity:\n' + errs.join('\n'));
}
