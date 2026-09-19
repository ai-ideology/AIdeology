/**
 * "你的 AI 世界观" — the explanation layer that turns raw axis numbers into
 * plain-language stance cards, so a finished result is understandable without
 * knowing the ideology taxonomy.
 *
 * Selection follows the content doc (§3): the primary ideology's 2–3 core axes,
 * then 1–2 of the user's own most extreme axes, then at most one balanced /
 * tension axis. No axis is repeated and no more than six cards are shown.
 */
import { axisCopyById, axisBand, ideologyBySlug } from '../content';
import type { AxisId } from '../content/types';
import { CORE_AXES, EXTENDED_AXES } from '../content/types';
import { esc } from '../ui/dom';
import type { ResultPackage } from '../scoring/engine';

const ALL: AxisId[] = [...CORE_AXES, ...EXTENDED_AXES];

interface Card {
  axis: AxisId;
  value: number;
}

export function worldviewCards(r: ResultPackage): Card[] {
  const used = new Set<AxisId>();
  const out: Card[] = [];
  const take = (axis: AxisId) => {
    if (used.has(axis) || out.length >= 6) return;
    used.add(axis);
    out.push({ axis, value: r.axes[axis] ?? 0 });
  };

  // 1. the primary ideology's own core axes (strongest targets first)
  const primary = r.primary ? ideologyBySlug.get(r.primary.slug) : undefined;
  if (primary) {
    ALL.filter((a) => primary.rule.axis_targets[a] !== undefined)
      .sort((a, b) => Math.abs(primary.rule.axis_targets[b] ?? 0) - Math.abs(primary.rule.axis_targets[a] ?? 0))
      .slice(0, 3)
      .forEach(take);
  }

  // 2. the user's most decisive personal axes
  ALL.filter((a) => !used.has(a))
    .sort((a, b) => Math.abs(r.axes[b] ?? 0) - Math.abs(r.axes[a] ?? 0))
    .slice(0, 2)
    .forEach(take);

  // 3. one balanced / conditional axis — shows "it depends" is a real answer
  const balanced = ALL.filter((a) => !used.has(a))
    .sort((a, b) => Math.abs(r.axes[a] ?? 0) - Math.abs(r.axes[b] ?? 0))[0];
  if (balanced && out.length < 6) take(balanced);

  return out;
}

export function renderWorldview(r: ResultPackage): string {
  const cards = worldviewCards(r);
  if (!cards.length) return '';
  const primary = r.primary ? ideologyBySlug.get(r.primary.slug) : undefined;
  const items = cards.map((c, i) => {
    const copy = axisCopyById[c.axis];
    const band = copy.bands[axisBand(c.value)];
    const lean = c.value >= 0 ? copy.right.label : copy.left.label;
    const strength = Math.abs(c.value);
    const flip = strength <= 0.25;
    const chip = flip ? '情境型' : lean;
    const pct = Math.round(50 + Math.max(-1, Math.min(1, c.value)) * 50);
    return `<article class="wv" style="--c:${copy.right.label === lean || flip ? 'inherit' : ''}">
      <div class="wv__top od-row">
        <span class="mono wv__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="mono wv__code od-fill">${esc(copy.name)}</span>
        <span class="kw wv__chip">${esc(chip)}</span>
      </div>
      <p class="mono wv__q">${esc(copy.plain)}</p>
      <p class="wv__band">${esc(band)}</p>
      <div class="wv__scale" role="img" aria-label="${esc(`${copy.plain}：${chip}`)}">
        <span class="wv__scale-pin" style="left:${pct}%" aria-hidden="true"></span>
      </div>
      <div class="wv__poles od-row mono"><span>${esc(copy.left.label)}</span><span class="od-fill"></span><span>${esc(copy.right.label)}</span></div>
    </article>`;
  }).join('');

  return `<section class="rsec rsec--wv">
    <header class="rsec__head">
      <h2 class="rsec__h">你的 AI 世界观</h2>
      <p class="mono rsec__sub">YOUR WORLDVIEW, IN PLAIN WORDS</p>
    </header>
    <p class="rsec__p wv__lead">一个主义名称不能说明全部。下面这些判断，更接近你真正相信的东西。</p>
    ${primary ? `<aside class="wv__claim" style="--c:${primary.copy.color};--f:${primary.copy.fg}">
      <span class="mono wv__claim-k">主意识形态主张 · ${esc(primary.copy.nameZh)}</span>
      <span class="wv__claim-v">${esc(primary.copy.summary)}</span>
    </aside>` : ''}
    <div class="wv-grid">${items}</div>
  </section>`;
}
