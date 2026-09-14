/**
 * Ideology Comparison Explorer — the 与你共鸣 / 与你分歧最大 module.
 *
 * Per the relations doc, the selector cards are NOT links: clicking one swaps
 * the comparison panel below (Master–Detail). Only the panel's
 * "查看主义详情" link navigates away. State lives in `compare` and is re-rendered
 * on its own so the whole page does not repaint.
 */
import {
  axisCopyById, differingAxes, ideologies, relationFor, relationPreview,
  resonanceAxes, sharedStance, versusStance,
} from '../content';
import type { Ideology } from '../content';
import type { AxisId } from '../content/types';
import { esc, motifSvg } from '../ui/dom';
import type { ResultPackage } from '../scoring/engine';

export type Kind = 'resonance' | 'contrast';

export interface CompareItem {
  slug: string;
  match: number | null;
}

export interface CompareState {
  resonance: CompareItem[];
  contrast: CompareItem[];
  selected: Record<Kind, string | null>;
}

const bySlug = (slug: string): Ideology | undefined => ideologies.find((x) => x.slug === slug);

export function buildCompareState(r: ResultPackage): CompareState {
  const resonance: CompareItem[] = r.resonance.map((s) => ({ slug: s.slug, match: s.finalFit }));
  const primary = r.primary?.slug;
  const contrast: CompareItem[] = r.scores
    .filter((s) => s.slug !== primary && s.finalFit < 56)
    .slice(-3)
    .reverse()
    .map((s) => ({ slug: s.slug, match: s.finalFit }));
  return {
    resonance,
    contrast,
    selected: {
      resonance: resonance[0]?.slug ?? null,
      contrast: contrast[0]?.slug ?? null,
    },
  };
}

function cardHtml(kind: Kind, item: CompareItem, self: Ideology, selected: boolean): string {
  const x = bySlug(item.slug);
  if (!x) return '';
  const c = x.copy;
  const preview = relationPreview(self, x, kind);
  // Resonance cards lead with the fit score; contrast cards lead with a ×
  // marker instead — a near-zero fit says "opposite", not "0 out of 100".
  const marker = kind === 'resonance'
    ? `<span class="mono xc__match">${item.match !== null && item.match > 0 ? item.match.toFixed(1) : '—'}</span>`
    : '<span class="xc__vs" aria-hidden="true">×</span>';
  return `<button type="button" class="xc xc--${kind}" role="tab" aria-selected="${selected}" data-act="pick-compare"
      data-kind="${kind}" data-slug="${item.slug}"
      style="--c:${c.color};--f:${c.fg}">
    <span class="xc__top od-row">
      <span class="mono xc__code od-fill">${x.code}</span>
      ${marker}
    </span>
    <span class="xc__motif" aria-hidden="true">${motifSvg(c.motif)}</span>
    <span class="xc__zh">${esc(c.nameZh)}</span>
    <span class="mono xc__en">${esc(c.nameEn)}</span>
    <span class="xc__preview">${esc(preview)}</span>
    <span class="mono xc__state">${selected ? 'SELECTED ↓' : '查看比较 ↓'}</span>
  </button>`;
}

function axisChip(axisId: string): string {
  const copy = axisCopyById[axisId as keyof typeof axisCopyById];
  if (!copy) return '';
  return `<span class="kw xc-axis"><span class="mono xc-axis__id">${axisId}</span>${esc(copy.plain)}</span>`;
}

type Axes = Partial<Record<AxisId, number>>;

const otherValue = (other: Ideology, axis: AxisId): number => other.rule.axis_targets[axis] ?? 0;

function panelHtml(kind: Kind, self: Ideology, other: Ideology, axes: Axes): string {
  const c = other.copy;
  const name = c.nameZh;
  const manual = relationFor(self.slug, other.slug);
  const isRes = kind === 'resonance';

  const sharedAxis = resonanceAxes(self, other, 1)[0];
  const diffAxis = differingAxes(self, other, 1)[0];

  // Concrete, stance-level copy — never the raw axis question.
  const sharedBody = manual?.shared ?? (sharedAxis
    ? sharedStance(sharedAxis, axes[sharedAxis] ?? 0, otherValue(other, sharedAxis), name)
    : `你和「${name}」的整体价值排序很接近。`);
  const diffBody = manual?.difference ?? (diffAxis
    ? versusStance(diffAxis, axes[diffAxis] ?? 0, otherValue(other, diffAxis), name)
    : `你和「${name}」的整体价值排序差异明显。`);

  // Resonance leads with what you share; contrast leads with where you split,
  // so the two columns swap order and headings but keep the same two sources.
  const firstCol = isRes
    ? { k: '为什么相近', b: sharedBody }
    : { k: '最大分歧', b: diffBody };
  const secondCol = isRes
    ? { k: '真正的分界', b: diffBody }
    : { k: '你们也有共识', b: sharedBody };

  const keyAxes = isRes ? resonanceAxes(self, other, 3) : differingAxes(self, other, 3);
  const oneLine = manual?.oneLine ?? autoOneLineText(self, other, isRes);

  const banner = isRes
    ? `<div class="xpanel__banner"><span class="xpanel__sym">＋</span><span class="mono xpanel__kind">OVERLAP · 共鸣</span></div>`
    : `<div class="xpanel__banner xpanel__banner--vs"><span class="xpanel__sym">×</span><span class="mono xpanel__kind">CONTRAST · 分歧</span></div>`;

  return `<div class="xpanel${isRes ? '' : ' xpanel--vs'}" style="--c:${c.color};--f:${c.fg}">
    ${banner}
    <h3 class="xpanel__h">${isRes ? `你和「${esc(name)}」的共同点` : `你和「${esc(name)}」的核心分歧`}</h3>
    <div class="xpanel__grid">
      <div class="xpanel__col">
        <p class="mono xpanel__k">${firstCol.k}</p>
        <p class="xpanel__b">${esc(firstCol.b)}</p>
      </div>
      <div class="xpanel__col">
        <p class="mono xpanel__k">${secondCol.k}</p>
        <p class="xpanel__b">${esc(secondCol.b)}</p>
      </div>
      <div class="xpanel__col xpanel__col--axes">
        <p class="mono xpanel__k">关键价值轴</p>
        <div class="od-cluster">${keyAxes.map(axisChip).join('')}</div>
      </div>
    </div>
    <p class="xpanel__oneline">${esc(oneLine)}</p>
    <a class="btn btn--lg xpanel__goto" href="#/ideology/${other.slug}">查看 ${esc(name)} 详情 <span aria-hidden="true">→</span></a>
  </div>`;
}

function autoOneLineText(self: Ideology, other: Ideology, resonance: boolean): string {
  const a = self.copy.nameZh;
  const b = other.copy.nameZh;
  const axes = resonance ? resonanceAxes(self, other, 1) : differingAxes(self, other, 1);
  const copy = axes[0] ? axisCopyById[axes[0]] : undefined;
  if (!copy) return `${a} 与 ${b} 的整体价值排序${resonance ? '接近' : '差异明显'}。`;
  return resonance
    ? `在「${copy.plain}」上，你们做出了同一个方向的选择。`
    : `同样面对「${copy.plain}」，你更靠近 ${a}，它更靠近 ${b}。`;
}

function groupHtml(kind: Kind, label: string, sub: string, state: CompareState, self: Ideology, axes: Axes): string {
  const items = state[kind];
  if (!items.length) {
    return `<section class="rsec xsec">
      <header class="rsec__head"><h2 class="rsec__h">${label}</h2><p class="mono rsec__sub">${sub}</p></header>
      <p class="rsec__p">${kind === 'resonance' ? '这一轮没有其他主义进入共鸣区间。' : '没有出现明显冲突的立场。'}</p>
    </section>`;
  }
  const sel = state.selected[kind] ?? items[0].slug;
  const selected = bySlug(sel)!;
  return `<section class="rsec xsec xsec--${kind}">
    <header class="rsec__head"><h2 class="rsec__h">${label}</h2><p class="mono rsec__sub">${sub}</p></header>
    <div class="xc-row" role="tablist" aria-label="${label}">${items.map((i) => cardHtml(kind, i, self, i.slug === sel)).join('')}</div>
    ${panelHtml(kind, self, selected, axes)}
  </section>`;
}

/** The whole comparison module, including the live re-render container. */
export function renderCompare(r: ResultPackage): string {
  const self = r.primary ? bySlug(r.primary.slug) : undefined;
  if (!self) return '';
  const state = buildCompareState(r);
  return `<div class="compare" id="compare-root" data-resonance="${esc(state.selected.resonance ?? '')}" data-contrast="${esc(state.selected.contrast ?? '')}">
    ${groupHtml('resonance', '与你共鸣', 'IDEOLOGIES YOU RESONATE WITH', state, self, r.axes)}
    ${groupHtml('contrast', '与你分歧最大', 'YOUR STRONGEST CONTRASTS', state, self, r.axes)}
  </div>`;
}

/**
 * Re-render just the two comparison groups after a card is picked, preserving
 * the other group's selection.
 */
export function repaintCompare(r: ResultPackage, state: CompareState): string {
  const self = r.primary ? bySlug(r.primary.slug) : undefined;
  if (!self) return '';
  return groupHtml('resonance', '与你共鸣', 'IDEOLOGIES YOU RESONATE WITH', state, self, r.axes) +
    groupHtml('contrast', '与你分歧最大', 'YOUR STRONGEST CONTRASTS', state, self, r.axes);
}

