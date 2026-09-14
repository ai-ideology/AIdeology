/** Shared presentational components used across views. */
import { dimensionById, hiddenCopyById } from '../content';
import type { Ideology } from '../content';
import type { AxisId } from '../content/types';
import { esc, motifSvg } from './dom';

export function posterHtml(x: Ideology, match?: number | null): string {
  const c = x.copy;
  const size = posterSize(x);
  const badge = match === null || match === undefined ? '' :
    `<span class="mono mini__match">${match.toFixed(1)}</span>`;
  const body = `<span class="poster__zh">${esc(c.nameZh)}</span>` +
    (size === 'feature'
      ? `<span class="poster__mf">${esc(c.manifestoEn)}</span><span class="poster__mfzh">${esc(c.manifestoZh)}</span>`
      : `<span class="poster__mf">${esc(c.manifestoZh)}</span>`);
  return `<a class="poster poster--${size}" href="#/ideology/${x.slug}" style="--c:${c.color};--f:${c.fg}">` +
    `<span class="poster__top od-row">` +
      `<span class="mono poster__code od-fill">${x.code}</span>` +
      `<span class="mono poster__fam">${badge || esc(c.family)}</span>` +
    `</span>` +
    `<span class="poster__motif" aria-hidden="true">${motifSvg(c.motif)}</span>` +
    `<span class="poster__body">${body}</span>` +
  `</a>`;
}

/** Deterministic poster shape so the masonry stays stable and lively. */
function posterSize(x: Ideology): 'feature' | 'tall' | 'wide' | 'square' | 'small' {
  const shapes = ['feature', 'tall', 'wide', 'square', 'small', 'square', 'tall', 'wide'] as const;
  return shapes[(x.id - 1) % shapes.length];
}

export function miniHtml(x: Ideology, match?: number | null): string {
  const c = x.copy;
  const badge = match === null || match === undefined ? '' :
    `<span class="mono mini__match">${match.toFixed(1)}</span>`;
  return `<a class="mini" href="#/ideology/${x.slug}" style="--c:${c.color};--f:${c.fg}">` +
    `<span class="mini__top od-row"><span class="mono mini__code od-fill">${x.code}</span>${badge}</span>` +
    `<span class="mini__motif" aria-hidden="true">${motifSvg(c.motif)}</span>` +
    `<span class="mini__zh">${esc(c.nameZh)}</span>` +
    `<span class="mini__en mono">${esc(c.nameEn)}</span>` +
  `</a>`;
}

export function keywordChips(words: string[]): string {
  return `<div class="od-cluster">${words.map((w) => `<span class="kw">${esc(w)}</span>`).join('')}</div>`;
}

export interface HiddenBadgeLike {
  id: string;
  nameZh: string;
  nameEn: string;
  summary: string;
  keywords: string[];
  reasons?: string[];
}

/**
 * Hidden stances ship without character art, so each badge carries a colored
 * emblem tile instead of a photo. Their identity (color/motif) lives in the
 * `hidden` block of ideologies.json.
 */
export function hiddenBadgesHtml(hidden: HiddenBadgeLike[]): string {
  return `<div class="badges">${hidden.map((h) => {
    const hc = hiddenCopyById.get(h.id);
    return `<article class="badge" style="--c:${hc?.color ?? '#0A0A0A'};--f:${hc?.fg ?? '#FFFFFF'}">
      <div class="badge__top od-row">
        <span class="mono badge__code od-fill">HIDDEN · ${esc(h.id)}</span>
        <span class="badge__emblem" aria-hidden="true">${motifSvg(hc?.motif ?? 'axis')}</span>
      </div>
      <h3 class="badge__h">${esc(h.nameZh)}</h3>
      <p class="mono badge__en">${esc(h.nameEn)}</p>
      ${hc?.nickname ? `<p class="badge__nick">「${esc(hc.nickname)}」</p>` : ''}
      <p class="badge__p">${esc(h.summary)}</p>
      ${keywordChips(h.keywords)}
      ${h.reasons?.length ? `<p class="mono badge__why">${h.reasons.map(esc).join(' · ')}</p>` : ''}
    </article>`;
  }).join('')}</div>`;
}

/**
 * Shared identity hero: colored text panel on the left, cropped character art
 * on the right. Used by both the ideology detail page and the result page.
 * `match` renders as a hard black tag pinned to the hero's top-right corner.
 */
export function splitHero(
  x: Ideology,
  opts: { metaLine?: string; match?: number | null; note?: string; actions: string },
): string {
  const c = x.copy;
  const match = opts.match;
  const matchTag = match === null || match === undefined ? '' :
    `<span class="hero-match"><span class="mono hero-match__label">MATCH</span><span class="hero-match__v">${match.toFixed(1)}</span></span>`;
  return `<header class="detail__hero" style="--c:${c.color};--f:${c.fg}">
    ${matchTag}
    <div class="detail__hero-text">
      ${opts.metaLine ? `<p class="mono detail__hero-code">${esc(opts.metaLine)}</p>` : ''}
      <h1 id="view-title" tabindex="-1" class="detail__hero-zh">${esc(c.nameZh)}</h1>
      <p class="mono detail__hero-en">${esc(c.nameEn)}</p>
      <p class="detail__hero-mfzh">${esc(c.manifestoZh)}</p>
      <p class="mono detail__hero-mfen">${esc(c.manifestoEn)}</p>
      <p class="detail__hero-summary">${esc(c.summary)}</p>
      ${opts.note ? `<p class="mono detail__hero-note">${opts.note}</p>` : ''}
      <div class="detail__hero-cta">${opts.actions}</div>
    </div>
    <figure class="detail__hero-art">
      <img src="./assets/char/${x.slug}.webp"
        alt="${esc(`${c.nameZh} ${c.nameEn}｜${c.manifestoZh}`)}"
        width="1000" height="941" loading="eager" decoding="async">
    </figure>
  </header>`;
}

export function axisRowHtml(axisId: AxisId, value: number, accent?: string): string {
  const axis = dimensionById.get(axisId);
  if (!axis) return '';
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  const pct = 50 + v * 50;
  const sign = v >= 0 ? '+' : '';
  const poleLabel = v >= 0 ? axis.right : axis.left;
  return `<div class="axis od-field">` +
    `<div class="axis__top od-row">` +
      `<span class="mono axis__code od-fixed">${axis.id}</span>` +
      `<span class="axis__zh od-fill">${esc(axis.name)}</span>` +
      `<span class="mono axis__v od-fixed od-nowrap">${sign}${v.toFixed(2)}</span>` +
    `</div>` +
    `<div class="axis__track" role="img" aria-label="${esc(`${axis.name}：${sign}${v.toFixed(2)}，${poleLabel}`)}"${accent ? ` style="--c:${accent}"` : ''}>` +
      `<span class="axis__mid" aria-hidden="true"></span>` +
      `<span class="axis__pin" style="left:${pct.toFixed(1)}%" aria-hidden="true"></span>` +
    `</div>` +
    `<div class="axis__poles od-row"><span>${esc(axis.left)}</span><span class="od-fill"></span><span>${esc(axis.right)}</span></div>` +
  `</div>`;
}
