import { describe, expect, test } from 'bun:test';
import { coreItems, adaptiveItems, hiddenItems, prototypeRules, ideologies, hiddenCopy } from '../src/content';
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
