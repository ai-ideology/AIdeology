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
- `src/content/axis-copy.json` — per-axis plain-language name, user question,
  two-pole definitions and the five summary bands. Generated verbatim from
  `设计方案/AIdeology_结果解释与主义关系文案库_v1.0.md` §4. The `plain` label
  and the band thresholds ([-0.65, -0.25, 0.25, 0.65]) drive the result page's
  「你的 AI 世界观」 cards and the axis labels everywhere.
- `src/content/ideology-profiles.json` — the doc's §6 four-field profile
  (一句话核心 / 最在意 / 最大担忧 / 理想未来) per ideology, shown on the detail
  page as 「快速认识它」.
- `src/content/relations.json` — the v1.1 doc's §10 hand-written pair copy, now
  typed. Each entry carries `relationType` (`opposite_direction` /
  `same_direction_degree` / `threshold_difference` / `motive_difference` /
  `priority_difference` / `scope_difference`), an optional `keyAxis`, a `degree`
  clause stating who goes further, and `oneLine`. Keyed order-independently.
  Pairs without manual copy get their type inferred (`inferRelationType`) and a
  stance-level fallback (`relationPreview` / `versusStance` / `sharedStance`).
- `src/content/families.json` — five family groups, matching the Hero pack and
  detail-layout spec (IDs 22–23 sit in F4 there; `naming.md` places 22–26 in
  “开放与世界秩序”. We follow the pack used by the images and layout spec).
- The 8 hidden stances in `ideologies.json` carry `color` / `fg` / `motif` /
  `nickname`. The frozen hidden rules name them but the image pack only covers
  the 26 core ideologies, so hidden stances ship **without character art**. On
  the result, share and wiki pages each renders as a black badge with a colored
  emblem tile (`hiddenBadgesHtml`). If artwork is generated later, add a
  `public/assets/char/<id>.webp` and the badge can switch to an image.

All are plain JSON: copy and taxonomy are configurable without touching
TypeScript.

## Question bank revision (v1.1)

`src/content/frozen/core_items_v1.1.json` and `adaptive_items_v1.1.json` are the
product owner's v1.1 revision (`设计方案/文案v1/*_v1.1_readable.json`), replacing
the earlier v1 bank. What changed and why:

- **Core: score-identical.** Same 48 ids, axes and option scores; 9 prompts and
  14 option-label sets were rewritten so the 23 `S5` items move along **one
  named variable** (`ordinal_variable`), making the ladder ordinally readable.
  No engine change was needed and all discrimination tests still pass.
- **Adaptive: five pairs replaced.** A11/A12/A21/A23/A24 became A11R/A12R/A21R/
  A23R/A24R with cleaner discriminators, and A07/A09 had their evidence
  direction corrected. Because the frozen `prototype_rules_v1.json`
  `adaptive_items` lists still name the old ids, **prototype↔adaptive linkage is
  now derived from each item's own `target_a`/`target_b`**
  (`adaptiveItemsByPrototype` in `src/content/index.ts`), which is also how
  `relevantEvidence` already read it. `planAdaptive` uses this map.
- **Relations: typed + degree.** The v1.1 copy library adds the relation-type
  system and a degree clause; see `relations.json` above. The result page's
  comparison panel renders the type chip and states the degree split in words
  ("你的立场更强 / 「X」的立场更强"), never as a chart. Pairs whose comparator
  holds no position on an axis are reported as a priority difference rather than
  a fake head-on conflict.
- **Comparison copy is user-centric.** The panel picks its axis from the
  **reader's** answers (`userResonanceAxes` / `userContrastAxes` in
  `src/content/index.ts`), not from the primary prototype's frozen vector. The
  earlier prototype-centric selection could land on a question the reader never
  took a side on and fall back to filler ("判断最接近 / 差异明显"). The fallback
  copy (`sharedStance` / `boundaryStance`) now always names the pole each side
  holds, and a same-pole split names whose position is stronger. The two-row
  position-bar comparator was removed in favour of these direct sentences.
- **Detail page: no 关键词 block, stances in plain words.** The 「关键词」 section
  was dropped (keywords still drive hidden badges). 「对关键问题的态度」 now leads
  each card with the axis's plain question (`axis-copy.json` `plain`) and the
  band text, with the pole as a black chip — the axis's technical pole names no
  longer appear as headings. The band copy is second-person, so the detail page
  swaps 你 → 它 (`copy.bands[axisBand(v)].replaceAll('你', '它')`).
- **Worldview carries the primary's claim.** The result page's 「你的 AI 世界观」
  shows the primary ideology's one-line `summary` in a color bar under the lead,
  so the plain-language cards have an explicit stance to compare against.
- **Mobile is its own layout, not a shrunken desktop** (design system §21). On
  phones the test screen drops the keyboard-shortcut hint (no physical keyboard)
  and the site footer (meaningless mid-test), places 上一题/下一题 side by side
  instead of stacked, and tightens spacing, question size and option height so
  all five choices stay above the fold — verified for **all 88 items at
  360×640**. The library's 26-poster mosaic collapses to a single column of
  ~150px cards (11000px → 5950px of scroll), nav tap targets grow to 40px, and
  hard shadows drop to 3–4px. Desktop rules are untouched.
- **No internal identifiers in the UI.** The design system's §9 mono examples
  (`IDEOLOGY_17`, `SCENARIO_014`) are a visual-language reference, not a licence
  to print bookkeeping keys: readers cannot act on `C-V1-01`, `IDEOLOGY_07`,
  `V10`, `M1`, `HIDDEN · machine-liberation`, or `v1 · 48 CORE · 24 ADAPTIVE`.
  All of them are gone from rendered copy, along with the 26-slot hero ordinal
  and the axis/step/layer codes. What replaced them is information the reader
  can use: the ideology's family, its name, the plain axis question, the step
  label (`核心题 3 / 48`), and the ideology's motif in the atlas node and panel.
  The codes stay in the frozen data and in `ProtoScore` — only rendering changed.
  Rule of thumb: if a string only identifies a row in the source data, it does
  not belong on screen.

The public-facing explanation of the whole design lives on the wiki page
(`src/views/wiki.ts` + `src/content/wiki.json`); its per-axis questions and
debate-map copy are editable there.
