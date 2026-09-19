import {
  axisBand, axisCopyById, declaredNeighbors, detailCopyBySlug,
  farthestIdeologies, ideologies, profileBySlug,
} from '../content';
import { CORE_AXES, EXTENDED_AXES, type AxisId } from '../content/types';
import { esc } from '../ui/dom';
import { axisRowHtml, miniHtml, splitHero } from '../ui/components';

/** The four canonical issue positions shown on every detail page. */
const ISSUES: { label: string; axis: AxisId }[] = [
  { label: 'AI 发展速度', axis: 'V1' },
  { label: '人类控制权', axis: 'V3' },
  { label: 'AI 经济分配', axis: 'V7' },
  { label: 'AI 治理方式', axis: 'V9' },
];

export function renderDetail(slug: string, hasResult = false): string | null {
  const x = ideologies.find((y) => y.slug === slug);
  if (!x) return null;
  const c = x.copy;
  const detail = detailCopyBySlug[slug];
  const profile = profileBySlug[slug];
  const index = ideologies.indexOf(x);
  const prev = ideologies[(index + ideologies.length - 1) % ideologies.length];
  const next = ideologies[(index + 1) % ideologies.length];
  const near = declaredNeighbors(x, 3);
  const far = farthestIdeologies(x, 2);

  const beliefs = (detail?.items ?? []).map((b, i) =>
    `<li class="belief-card">
      <span class="mono belief-card__n">0${i + 1}</span>
      <h3 class="belief-card__h">${esc(b.h)}</h3>
      <p class="belief-card__p">${esc(b.p)}</p>
    </li>`,
  ).join('');

  // Same plain-language treatment as the result page's 「你的 AI 世界观」:
  // the issue label stays as the category, but the card leads with the axis's
  // plain question and states the ideology's stance in words, not a technical
  // pole name. Band copy is second-person for the reader, so switch it to 它.
  const positions = ISSUES.map((issue) => {
    const copy = axisCopyById[issue.axis];
    const v = x.rule.axis_targets[issue.axis] ?? 0;
    const lean = v >= 0 ? copy.right.label : copy.left.label;
    const stance = copy.bands[axisBand(v)].replaceAll('你', '它');
    const pct = 50 + Math.max(-1, Math.min(1, v)) * 50;
    return `<li class="position od-tile">
      <div class="position__top od-row">
        <span class="mono position__label od-fill">${esc(issue.label)}</span>
        <span class="kw position__chip">${esc(lean)}</span>
      </div>
      <p class="position__q">${esc(copy.plain)}</p>
      <p class="position__view">${esc(stance)}</p>
      <span class="position__bar" role="img" aria-label="${esc(`${copy.plain}：偏向 ${lean}`)}">
        <span class="position__mid" aria-hidden="true"></span>
        <span class="position__pin" style="left:${pct.toFixed(1)}%"></span>
      </span>
      <span class="mono position__poles"><span>${esc(copy.left.label)}</span><span>${esc(copy.right.label)}</span></span>
    </li>`;
  }).join('');

  const axes = [...CORE_AXES, ...EXTENDED_AXES]
    .map((a) => axisRowHtml(a, x.rule.axis_targets[a] ?? 0, c.color))
    .join('');

  return `<article class="detail" style="--c:${c.color};--f:${c.fg}">
    ${splitHero(x, {
      metaLine: c.family,
      actions:
        `<button type="button" class="btn btn--hero" data-act="start-test">${hasResult ? '重新测试' : '开始测试'} <span aria-hidden="true">→</span></button>` +
        '<a class="btn btn--hero" href="#/library">查看图鉴</a>',
    })}
    <div class="detail__body">
      <section class="dsec">
        <h2 class="dsec__h">这个主义是什么</h2>
        <p class="dsec__lead">${esc(c.summary)}</p>
        <p class="dsec__en mono">${esc(c.nameEn)}</p>
      </section>

      ${profile ? `<section class="dsec dsec--profile">
        <h2 class="dsec__h">快速认识它</h2>
        <p class="mono dsec__sub">AT A GLANCE · 核心 / 最在意 / 最大担忧 / 理想未来</p>
        <div class="profile-grid">
          <article class="profile-i profile-i--core">
            <p class="mono profile-i__k">一句话核心</p>
            <p class="profile-i__v">${esc(profile.core)}</p>
          </article>
          <article class="profile-i">
            <p class="mono profile-i__k">最在意</p>
            <p class="profile-i__v">${esc(profile.cares)}</p>
          </article>
          <article class="profile-i">
            <p class="mono profile-i__k">最大担忧</p>
            <p class="profile-i__v">${esc(profile.worry)}</p>
          </article>
          <article class="profile-i profile-i--future">
            <p class="mono profile-i__k">理想未来</p>
            <p class="profile-i__v">${esc(profile.future)}</p>
          </article>
        </div>
      </section>` : ''}

      <section class="dsec">
        <h2 class="dsec__h">核心信念</h2>
        <ol class="belief-list">${beliefs}</ol>
      </section>

      <section class="dsec">
        <h2 class="dsec__h">对关键问题的态度</h2>
        <p class="mono dsec__sub">4 POSITIONS · 议题 / 立场 / 光谱位置</p>
        <ul class="positions">${positions}</ul>
      </section>

      <section class="dsec">
        <h2 class="dsec__h">世界观摘要</h2>
        <p class="dsec__p">${esc(c.worldview)}</p>
        ${detail?.origin ? `<p class="dsec__origin"><b class="mono">思想来源</b>${esc(detail.origin)}</p>` : ''}
      </section>

      <section class="dsec">
        <h2 class="dsec__h">价值坐标</h2>
        <p class="mono dsec__sub">AXIS TARGET · 该主义在 15 条轴上的典型位置</p>
        <div class="axes">${axes}</div>
      </section>

      <section class="dsec">
        <h2 class="dsec__h">相近主义</h2>
        <div class="mini-grid">${near.map((y) => miniHtml(y)).join('')}</div>
      </section>

      <section class="dsec">
        <h2 class="dsec__h">冲突主义</h2>
        <div class="mini-grid">${far.map((y) => miniHtml(y)).join('')}</div>
      </section>

      <nav class="detail__nav od-row" aria-label="主义间导航">
        <a class="detail__navlink" href="#/ideology/${prev.slug}"><span class="mono">← 上一个</span><span>${esc(prev.copy.nameZh)}</span></a>
        <a class="detail__navlink detail__navlink--r" href="#/ideology/${next.slug}"><span class="mono">下一个 →</span><span>${esc(next.copy.nameZh)}</span></a>
      </nav>
    </div>
  </article>`;
}
