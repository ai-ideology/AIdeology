# Implementation decisions

The frozen v1 package (`src/content/frozen/`) is authoritative for theory, items
and thresholds. It leaves a handful of runtime rules unspecified. This file
records the choice made for each, so they can be revisited without reading the
engine top to bottom.

## Resolved from the frozen package (no choice needed)

- **Axis scoring** — `axis_score = mean(item score / 2)`, range −1..1. Option
  scores in the item bank are already direction-coded, so no runtime sign flip.
- **AxisFit** — neutral-baseline-adjusted prototype fit, exactly the formula in
  `scoring_spec_v1.json`. Guarantee verified by test: all-middle answers give
  AxisFit = 50 for all 26 prototypes.
- **DiscEvidence** — `50 + 50 × mean(relevant adaptive evidence)`, reading the
  `evidence_a` / `evidence_b` channel of the answered item whose pair contains
  the prototype. Non-zero-sum by construction. No relevant items → 50.
- **RawFit / FinalFit** — `0.50·AxisFit + 0.30·DiscEvidence + 0.15·Hallmark +
  0.05·Consistency`, then `clamp(RawFit − penalty, 0, 100)`.
- **Hallmark** — PASS 100 / PARTIAL 50 / FAIL 0. Every hallmark condition is one
  independent source; PASS needs ≥ 2 hits (`minimum_independent_sources`), and a
  required adaptive item that was never asked caps the result at PARTIAL. Middle
  answers (score 0) never count as evidence.
- **Contradictions** — medium −10, strong −25, from the per-prototype
  `contradictions[]` rules.
- **Selection thresholds** — strong 70 / primary 64 / resonance 56 / clear gap 7;
  dual gap ≤ 4 with both ≥ 66 and both Hallmark PASS; mixed when gap ≤ 5 with
  insufficient Hallmark; low-information when mid-rate ≥ 38 %, mean |axis| < 0.25
  and Top1−Top2 < 7. Resonance capped at 3.
- **Normalism** — meta-fallback: M1 ≤ −0.40, ≥ 2 of 3 M1 items explicitly
  normalcy, A22 not strongly anti-normalism, and no other prototype ≥ 70.
  Otherwise normalism is only an “AI 常态倾向” note, which the report shows.
- **Hidden ideologies** — all 8 rules with their prerequisites, “both topic items
  ≥ +1 and at least one = +2” trigger, false-positive guards, and the
  digital-life / algorithmic-opt hallmark guards. Ranked by evidence strength,
  capped at 2 badges.

## Choices made where the spec is silent

1. **Unanswered axis → neutral 0.** `mean(...)` implies an answered-only mean;
   an axis with no answers reads 0 rather than being dropped. Coverage is
   surfaced through measurement confidence instead.
2. **Adaptive planning.** The spec gives the 6–10 range, the union mechanism and
   the frozen transhumanism forced route, but no top-N. We take the top 8
   competing prototypes by AxisFit as the candidate neighbourhood, always
   include any `adaptive_required` items of the top 3, add the transhumanism
   route when its V3/V8 pattern is close, add normalism's A22 when M1 ≤ −0.35,
   then keep 6–10 unique items. Discriminant evidence is computed per prototype
   from whichever of its adaptive items were actually asked.
3. **Hidden item screening.** A hidden rule's topic items are asked (up to 4)
   when its prerequisites hold within a small margin (axes ±0.12, prototype fit
   −8), so the engine can then confirm or reject the badge with the strict rule.
4. **Contradiction stacking.** Overlapping contradiction signals are treated as
   non-independent: the single strongest penalty applies rather than summing.
5. **Consistency formula.** The 0.05 weight is frozen but no formula is given.
   We measure cross-item agreement within each axis with ≥ 2 answered items as
   `1 − mean absolute deviation`, averaged and scaled to 0–100.
6. **Confidence calibration.** The three field names are frozen, but not their
   numeric mapping. Identity = primary FinalFit; Discrimination = Top1−Top2 gap
   over 15; Measurement = 0.6·coverage + 0.4·consistency. Labels use
   高 / 中 / 低 bands.
7. **Belief tags (B1–B6).** The pack declares the module but ships no items or
   formula. We intentionally surface only what the frozen axes can honestly
   support (X3 → 时间伦理: 当代优先 ↔ 长期主义) rather than invent a B-item set.
   Adding B items later is a content-only change.
8. **`special_positive_means_hidden`.** Never defined in prose; the two flagged
   rules (human-authenticism, digital-restraint) are not inverted — a positive
   topic score still means the hidden applies.

## Presentation-layer content authored here (editable)

- `src/content/ideologies.json` — hero copy. Name / English name / manifesto /
  one-line summary are verbatim from the Hero copy pack. `worldview`, `keywords`,
  `nickname` and `color` are authored for the app.
- `src/content/detail-copy.json` — three core beliefs + a short 思想来源 note per
  ideology.
- `src/content/families.json` — five family groups, matching the Hero pack and
  detail-layout spec (IDs 22–23 sit in F4 there; `naming.md` places 22–26 in
  “开放与世界秩序”. We follow the pack used by the images and layout spec).

All three are plain JSON: copy and taxonomy are configurable without touching
TypeScript.

## Question bank revision

The bank in `src/content/frozen/` is the product owner's readable revision
(`设计方案/题库/*_readable.json`). It is score-identical to the earlier frozen
bank — same ids, axes, option scores and evidence channels — with clearer
wording and an added `scenario` setup field, which the test view renders above
the question. No engine change was needed.

The public-facing explanation of the whole design lives on the wiki page
(`src/views/wiki.ts` + `src/content/wiki.json`); its per-axis questions and
debate-map copy are editable there.
