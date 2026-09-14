/**
 * Content layer. Everything the app renders or scores from is loaded here, so
 * copy and question banks stay configurable (edit the JSON, not the code).
 */
import coreItemsJson from './frozen/core_items_v1.json';
import adaptiveItemsJson from './frozen/adaptive_items_v1.json';
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

import type {
  AdaptiveItem, AxisCopy, AxisId, CoreItem, Dimension, Family, HiddenCopy, HiddenItem,
  HiddenRule, IdeologyCopy, IdeologyProfile, PrototypeRule, RelationPair,
} from './types';
import { CORE_AXES, EXTENDED_AXES } from './types';

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

/** Relation copy keyed by an order-independent slug pair. */
const relationKey = (a: string, b: string) => [a, b].sort().join('|');
export const relationByPair = new Map(relations.map((r) => [relationKey(r.pair[0], r.pair[1]), r]));
export function relationFor(a: string, b: string): RelationPair | undefined {
  return relationByPair.get(relationKey(a, b));
}

/** Which of the five front-end bands a raw axis score falls into. */
export function axisBand(v: number): keyof AxisCopy['bands'] {
  if (v < -0.65) return 'strong_left';
  if (v < -0.25) return 'left';
  if (v <= 0.25) return 'center';
  if (v <= 0.65) return 'right';
  return 'strong_right';
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

/** Adaptive items relevant to a set of prototype slugs. */
export function adaptiveItemsFor(slugs: string[]): AdaptiveItem[] {
  const wanted = new Set<string>();
  for (const slug of slugs) {
    for (const id of ruleById.get(slug)?.adaptive_items ?? []) wanted.add(id);
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

/**
 * One-line "why you're alike / where you split" teaser for a selector card.
 * Prefers the hand-written relation copy; otherwise derives it from the axis
 * where the two prototypes are closest (resonance) or furthest (contrast).
 */
export function relationPreview(self: Ideology, other: Ideology, kind: 'resonance' | 'contrast'): string {
  const manual = relationFor(self.slug, other.slug);
  if (manual) {
    return kind === 'resonance' ? manual.shared : manual.difference;
  }
  if (kind === 'contrast') {
    const diff = differingAxes(self, other, 1)[0];
    const copy = diff ? axisCopyById[diff] : undefined;
    return copy ? `你们在「${copy.plain}」上分歧最大。` : '你们的整体价值排序差异明显。';
  }
  const shared = sharedAxes(self, other, 1)[0];
  if (shared) {
    const copy = axisCopyById[shared];
    return copy ? `你们都重视「${copy.plain}」。` : '你们有共同的价值取向。';
  }
  const close = closestAxes(self, other, 1)[0];
  const copy = close ? axisCopyById[close] : undefined;
  return copy ? `你们在「${copy.plain}」上的判断最接近。` : '你们的整体价值排序很接近。';
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
