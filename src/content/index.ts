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

import type {
  AdaptiveItem, AxisId, CoreItem, Dimension, Family, HiddenCopy, HiddenItem,
  HiddenRule, IdeologyCopy, PrototypeRule,
} from './types';

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
  if (errs.length) console.error('[content] integrity:\n' + errs.join('\n'));
}
