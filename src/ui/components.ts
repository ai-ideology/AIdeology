/** Shared presentational components used across views. */
import { dimensionById } from '../content';
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
