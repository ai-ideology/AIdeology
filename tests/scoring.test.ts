import { describe, expect, test } from 'bun:test';
import {
  coreItems, adaptiveItems, hiddenItems, prototypeRules, ideologies, hiddenCopy,
  adaptiveItemsByPrototype, boundaryStance, compareDegree, degreeBand, relationFor, relations,
  sharedStance, userResonanceAxes,
} from '../src/content';
import type { AxisId } from '../src/content/types';
import { axisScores, axisFit, computeResult, emptyAnswers, planAdaptive, scoreItems } from '../src/scoring/engine';
import type { SessionAnswers } from '../src/scoring/engine';

/** Pick, for every core item, the option closest to a prototype's axis target. */
function profileFor(slug: string): SessionAnswers {
  const rule = prototypeRules.find((r) => r.id === slug)!;
  const a: SessionAnswers = emptyAnswers();
  for (const item of coreItems) {
    const target = rule.axis_targets[item.axis] ?? 0;
    let bestIdx = 2;
    let bestD = Infinity;
    item.options.forEach((o, i) => {
      const d = Math.abs(o.score / 2 - target);
      if (d < bestD) { bestD = d; bestIdx = i; }
    });
    a.core[item.id] = bestIdx;
  }
  return a;
}

function allMiddle(): SessionAnswers {
  const a = emptyAnswers();
  for (const item of coreItems) a.core[item.id] = 2; // "不确定 / 看情况"
  return a;
}

describe('content integrity', () => {
  test('frozen item counts', () => {
    expect(coreItems.length).toBe(48);
    expect(adaptiveItems.length).toBe(24);
    expect(hiddenItems.length).toBe(16);
    expect(prototypeRules.length).toBe(26);
    expect(ideologies.length).toBe(26);
  });
  test('every core axis has 3 items', () => {
    const counts: Record<string, number> = {};
    for (const i of coreItems) counts[i.axis] = (counts[i.axis] ?? 0) + 1;
    for (const [axis, n] of Object.entries(counts)) expect([axis, n]).toEqual([axis, 3]);
    expect(Object.keys(counts).length).toBe(16);
  });
  test('every adaptive item has at least one target that is a real prototype', () => {
    const proto = new Set(prototypeRules.map((r) => r.name));
    const hidden = new Set(hiddenCopy.map((h) => h.nameZh));
    for (const a of adaptiveItems) {
      // each pair feeds >=1 core prototype; the other side may be a hidden or
      // meta descriptor (e.g. A09 -> 机器解放主义, A22 -> 强AI中心原型)
      expect(proto.has(a.target_a) || proto.has(a.target_b)).toBe(true);
      for (const t of [a.target_a, a.target_b]) {
        expect(proto.has(t) || hidden.has(t) || t === '强AI中心原型').toBe(true);
      }
    }
  });

  test('v1.1 core bank keeps one ordinal variable per S5 item', () => {
    const s5 = coreItems.filter((i) => i.type === 'S5');
    expect(s5.length).toBe(23);
    for (const item of s5) {
      expect(typeof item.ordinal_variable).toBe('string');
      expect(item.ordinal_variable!.length).toBeGreaterThan(0);
      // one option per ladder step; a few items present it strongest-first, so
      // compare as a set rather than a fixed order
      expect([...item.options.map((o) => o.score)].sort((a, b) => a - b))
        .toEqual([-2, -1, 0, 1, 2]);
    }
  });

  test('adaptive linkage is derived from the bank and covers every prototype', () => {
    // v1.1 replaced A11/A12/A21/A23/A24 with *R, so the frozen per-rule lists
    // are stale; the bank declaration is the source of truth.
    expect(adaptiveItemsByPrototype.get('work-humanism')).toContain('A11R');
    expect(adaptiveItemsByPrototype.get('post-work')).toContain('A11R');
    expect(adaptiveItemsByPrototype.get('digital-life')).toContain('A12R');
    expect(adaptiveItemsByPrototype.get('human-primacy')).toContain('A12R');
    // no stale v1 ids survive as the only link for a replaced pair
    const all = [...adaptiveItemsByPrototype.values()].flat();
    for (const dead of ['A11', 'A12', 'A21', 'A23', 'A24']) {
      if (dead === 'A22') continue;
      // A11/A12/... must not be linked; only *R variants exist in the v1.1 bank
      expect(all).not.toContain(dead);
    }
  });

  test('degree comparator bands and direction follow the v1.1 thresholds', () => {
    expect(degreeBand(0.1)).toBe('equal');
    expect(degreeBand(0.2)).toBe('slightly');
    expect(degreeBand(0.5)).toBe('clearly');
    expect(degreeBand(0.8)).toBe('far');
    const other = ideologies.find((x) => x.slug === 'post-work')!;
    // user far on the "labour-human" side vs a post-work prototype -> opposite
    const cmp = compareDegree('V6', -1, other);
    expect(cmp.prototype).toBeGreaterThan(0);
    expect(Math.sign(cmp.user)).not.toBe(Math.sign(cmp.prototype));
    expect(cmp.relevant).toBe(true);
  });

  test('v1.1 relations carry a typed relation and one-line comparison', () => {
    expect(relations.length).toBeGreaterThanOrEqual(18);
    for (const r of relations) {
      expect(r.pair.length).toBe(2);
      expect(r.oneLine.length).toBeGreaterThan(0);
      expect(typeof r.relationType).toBe('string');
    }
    // order-independent lookup
    expect(relationFor('post-work', 'work-humanism')?.oneLine)
      .toBe(relationFor('work-humanism', 'post-work')?.oneLine);
    // a pair that must be typed as opposite directions
    expect(relationFor('work-humanism', 'post-work')?.relationType).toBe('opposite_direction');
    expect(relationFor('work-humanism', 'post-work')?.keyAxis).toBe('V6');
  });

  test('comparison copy names the pole, never a bare "判断最接近 / 差异明显"', () => {
    const armsRace = ideologies.find((x) => x.slug === 'arms-race')!;
    const digitalLife = ideologies.find((x) => x.slug === 'digital-life')!;
    // a reader who shares arms-race's race pole and digital-life's V4 pole
    const axes: Partial<Record<AxisId, number>> = { V12: 0.7, V4: 0.4, V11: 0.6, V10: 0.7 };

    expect(userResonanceAxes(armsRace, axes, 1)[0]).toBe('V12');
    expect(userResonanceAxes(digitalLife, axes, 1)[0]).toBe('V4');

    const shared = sharedStance('V12', 0.7, armsRace.rule.axis_targets.V12 ?? 0, armsRace.copy.nameZh);
    expect(shared).toContain('军备竞速');
    expect(shared).not.toContain('判断最接近');

    const boundary = boundaryStance('V12', 0.7, armsRace);
    expect(boundary).toContain('军备竞速主义');
    expect(boundary).not.toContain('差异明显');

    // opposite camps must state both concrete positions, not just "差异明显"
    const intl = ideologies.find((x) => x.slug === 'ai-internationalism')!;
    const b2 = boundaryStance('V11', 0.6, intl);
    expect(b2).toContain('本国自主掌握');
    expect(b2).toContain('国际机构、共同规则');
    expect(b2).not.toContain('差异明显');
  });

  test('user-centric axis selection keeps the reader on an axis it answers', () => {
    const armsRace = ideologies.find((x) => x.slug === 'arms-race')!;
    // prior prototype-centric selector could land on an axis the reader left at 0
    const axes: Partial<Record<AxisId, number>> = { V12: 0.8, V2: 0, V4: 0, V5: 0 };
    const pick = userResonanceAxes(armsRace, axes, 1)[0];
    expect(axes[pick]).not.toBe(0);
  });
});

describe('AxisFit neutral baseline (frozen guarantee)', () => {
  test('all-middle answers give AxisFit 50 for every prototype', () => {
    const scores = scoreItems(allMiddle());
    const axes = axisScores(scores);
    for (const rule of prototypeRules) {
      expect(axisFit(axes, rule)).toBeCloseTo(50, 6);
    }
  });
  test('axis score 0 is included, not treated as missing', () => {
    const scores = scoreItems(allMiddle());
    expect(scores.size).toBe(48);
    const axes = axisScores(scores);
    for (const v of Object.values(axes)) expect(v).toBe(0);
  });
});

describe('discrimination', () => {
  test('a promethean-shaped profile ranks promethean first', () => {
    const r = computeResult(profileFor('promethean'));
    expect(r.scores[0].slug).toBe('promethean');
    expect(r.scores[0].finalFit).toBeGreaterThan(70);
  });

  test('a pause-shaped profile ranks pause first', () => {
    const r = computeResult(profileFor('pause'));
    expect(r.scores[0].slug).toBe('pause');
    expect(r.scores[0].finalFit).toBeGreaterThan(70);
  });

  test('shaped profiles never pick a contradictory prototype as primary', () => {
    // pause profile must not yield arms-race top; arms-race profile must not yield pause top
    expect(computeResult(profileFor('pause')).scores[0].slug).not.toBe('arms-race');
    expect(computeResult(profileFor('arms-race')).scores[0].slug).not.toBe('pause');
  });

  test('all-middle under-informs and is not a confident single primary', () => {
    const r = computeResult(allMiddle());
    expect(r.type).toBe('low_information');
    expect(r.meta.midRate).toBe(1);
    expect(r.meta.meanAbsAxis).toBeLessThan(0.25);
  });

  test('hidden badge triggers only with prerequisites + topic support', () => {
    const base = profileFor('digital-life');
    const noTopic = computeResult(base);
    expect(noTopic.hidden.find((h) => h.id === 'machine-emancipation')).toBeUndefined();

    const withTopic: SessionAnswers = { ...base, hidden: { H01: 4, H02: 4 } };
    const r = computeResult(withTopic);
    expect(r.hidden.find((h) => h.id === 'machine-emancipation')).toBeDefined();
    expect(r.hidden.length).toBeLessThanOrEqual(2);
  });
});

describe('adaptive planning', () => {
  test('always plans between 6 and 10 unique items', () => {
    for (const slug of ['promethean', 'pause', 'transhumanism', 'normalism', 'intelligence-commons']) {
      const scores = scoreItems(profileFor(slug));
      const plan = planAdaptive(axisScores(scores));
      expect(plan.itemIds.length).toBeGreaterThanOrEqual(6);
      expect(plan.itemIds.length).toBeLessThanOrEqual(10);
      expect(new Set(plan.itemIds).size).toBe(plan.itemIds.length);
    }
  });
});

function blendProfiles(s1: string, s2: string, w: number): SessionAnswers {
  const r1 = prototypeRules.find((r) => r.id === s1)!;
  const r2 = prototypeRules.find((r) => r.id === s2)!;
  const a = emptyAnswers();
  for (const item of coreItems) {
    const k = item.axis as keyof typeof r1.axis_targets;
    const t = (r1.axis_targets[k] ?? 0) * w + (r2.axis_targets[k] ?? 0) * (1 - w);
    let best = 2, bd = Infinity;
    item.options.forEach((o, i) => { const d = Math.abs(o.score / 2 - t); if (d < bd) { bd = d; best = i; } });
    a.core[item.id] = best;
  }
  return a;
}

test('a weighted blend stays a legal result type', () => {
  const r = computeResult(blendProfiles('safe-progress', 'survival', 0.6));
  expect(['single_primary', 'primary_plus_resonance', 'dual_core', 'mixed', 'low_information']).toContain(r.type);
});

describe('discrimination sweep across all 26 prototypes', () => {
  test('each prototype-shaped profile puts that prototype in the top 3', () => {
    const misses: string[] = [];
    for (const rule of prototypeRules) {
      const r = computeResult(profileFor(rule.id));
      const rank = r.scores.findIndex((s) => s.slug === rule.id) + 1;
      if (rank > 3) misses.push(`${rule.id} rank ${rank}`);
    }
    expect(misses).toEqual([]);
  });

  test('at least 24 of 26 profiles rank their own prototype first', () => {
    let exact = 0;
    for (const rule of prototypeRules) {
      if (computeResult(profileFor(rule.id)).scores[0].slug === rule.id) exact++;
    }
    expect(exact).toBeGreaterThanOrEqual(24);
  });

  test('all-middle is low_information; a strong shaped profile is a single primary', () => {
    expect(computeResult(allMiddle()).type).toBe('low_information');
    expect(computeResult(profileFor('intelligence-commons')).type).toBe('single_primary');
  });

  test('all five result types are reachable from core answers', () => {
    expect(computeResult(allMiddle()).type).toBe('low_information');
    // deterministic vectors found by seeded search; each maps onto one band
    const VECTORS: [string, number[]][] = [
      ['dual_core', [1,3,3,4,3,3,0,4,0,1,3,4,2,4,1,4,2,2,0,2,3,4,4,4,3,4,2,0,1,3,3,3,3,3,3,4,3,0,3,1,3,2,2,3,2,2,1,2]],
      ['mixed', [3,2,3,4,3,3,1,4,3,4,3,2,4,1,3,1,1,4,4,4,0,3,3,2,1,2,4,4,2,2,4,1,1,2,2,3,4,3,4,1,2,4,4,2,3,4,3,0]],
      ['primary_plus_resonance', [0,1,4,2,2,0,4,2,3,4,4,4,2,1,3,0,0,4,2,4,3,1,1,0,3,3,3,0,1,1,0,1,0,1,4,0,3,4,0,3,3,2,0,0,1,3,4,3]],
      ['single_primary', [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],
    ];
    for (const [expected, vec] of VECTORS) {
      const a = emptyAnswers();
      coreItems.forEach((item, i) => { a.core[item.id] = vec[i]; });
      const r = computeResult(a);
      expect(r.type).toBe(expected as typeof r.type);
    }
  });
});
