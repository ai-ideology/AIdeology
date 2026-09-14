import { CORE_AXES, EXTENDED_AXES } from '../content/types';
import { ideologies, type Ideology } from '../content';
import { esc, pad2 } from '../ui/dom';
import { axisRowHtml, hiddenBadgesHtml, miniHtml, splitHero } from '../ui/components';
import { RESULT_TYPE_LABEL, type ResultPackage } from '../scoring/engine';

function bySlug(slug: string): Ideology | undefined {
  return ideologies.find((x) => x.slug === slug);
}

export function renderResultEmpty(): string {
  return `<section class="empty">
    <p class="mono empty__code">NO RESULT YET</p>
    <h1 id="view-title" tabindex="-1">还没有你的结果</h1>
    <p class="empty__p">完成 48 道核心情景题与随后的判别题后，这里会出现你的意识形态海报、价值轴定位、隐藏徽章，以及与它相近和冲突的立场。</p>
    <div class="od-cluster">
      <button type="button" class="btn btn--primary btn--lg" data-act="start-test">开始测试</button>
      <a class="btn btn--lg" href="#/library">先看图鉴</a>
    </div>
  </section>`;
}

function confidenceRow(label: string, value: number, text: string): string {
  return `<div class="conf od-row">
    <span class="conf__label od-fill"><b>${esc(label)}</b><span class="mono conf__en">${esc(text)}</span></span>
    <span class="conf__bar"><span class="conf__fill" style="width:${Math.max(4, Math.min(100, value)).toFixed(0)}%"></span></span>
    <span class="mono conf__val">${value.toFixed(0)}</span>
  </div>`;
}

export function renderResult(r: ResultPackage): string {
  const primary = r.primary ? bySlug(r.primary.slug) : null;
  const typeLabel = RESULT_TYPE_LABEL[r.type];

  const hero = primary ? resultHero(primary, r) : lowInfoHero(r);

  const axesHtml = [...CORE_AXES, ...EXTENDED_AXES]
    .map((a) => axisRowHtml(a, r.axes[a] ?? 0, primary?.copy.color))
    .join('');

  const resonanceCards = r.resonance.length
    ? `<div class="mini-grid">${r.resonance.map((s) => miniHtml(bySlug(s.slug)!, s.finalFit)).join('')}</div>`
    : `<p class="rsec__p">这一轮没有其他主义进入共鸣区间。</p>`;

  const tensions = r.scores
    .filter((s) => s.slug !== r.primary?.slug && s.finalFit < 56)
    .slice(-3)
    .reverse();
  const tensionCards = tensions.length
    ? `<div class="mini-grid">${tensions.map((s) => miniHtml(bySlug(s.slug)!)).join('')}</div>`
    : `<p class="rsec__p">没有出现明显冲突的立场。</p>`;

  const hiddenSection = r.hidden.length
    ? `<section class="rsec">
        <h2 class="rsec__h">隐藏徽章</h2>
        <p class="mono rsec__sub">HIDDEN BADGES · 稀有的边界立场，不替代主意识形态</p>
        ${hiddenBadgesHtml(r.hidden)}
      </section>`
    : '';

  const topList = r.scores.slice(0, 8).map((s, i) => {
    const x = bySlug(s.slug)!;
    const isPrimary = s.slug === r.primary?.slug;
    const pct = Math.max(0, Math.min(100, s.finalFit));
    return `<li class="rank${isPrimary ? ' is-primary' : ''}" style="--c:${x.copy.color};--f:${x.copy.fg};--w:${pct.toFixed(1)}%">
      <span class="mono rank__i">${pad2(i + 1)}</span>
      <a class="rank__name" href="#/ideology/${x.slug}">${esc(x.copy.nameZh)}</a>
      <span class="rank__bar" aria-hidden="true"></span>
      <span class="mono rank__v">${s.finalFit.toFixed(1)}</span>
    </li>`;
  }).join('');

  const normalismNote = r.normalism.tagOnly
    ? `<p class="rsec__p normalism-note">你同时呈现出明显的 <b>AI 常态倾向</b>：AI 更像一项长期铺开的基础设施，而不是神话或末日。由于其他立场也有很高的贴合度，它在此仅作为标签保留。</p>`
    : '';

  const belief = r.beliefTags.length
    ? `<section class="rsec"><h2 class="rsec__h">相关信念倾向</h2>
        <p class="rsec__sub mono">INDEPENDENT B-BELIEF MODULE</p>
        <div class="beliefs">${r.beliefTags.map((b) => `<div class="belief od-row">
          <span class="belief__label">${esc(b.left)} ↔ ${esc(b.right)}</span>
          <span class="kw">${esc(b.label)}</span>
        </div>`).join('')}</div></section>`
    : '';

  return `<article class="result"${primary ? ` style="--c:${primary.copy.color};--f:${primary.copy.fg}"` : ''}>
    ${hero}
    <div class="result__body">
      <section class="rsec">
        <header class="rsec__head">
          <h2 class="rsec__h">价值轴定位</h2>
          <p class="mono rsec__sub">AXIS VECTOR · 15 DIMENSIONS + M1 · ${r.meta.answeredCore} / ${r.meta.totalCore} CORE ITEMS</p>
        </header>
        <div class="axes">${axesHtml}</div>
      </section>

      <section class="rsec">
        <h2 class="rsec__h">结果可信度</h2>
        <p class="mono rsec__sub">CREDIBILITY · 结果类型：${esc(typeLabel)}</p>
        <div class="conf-list">
          ${confidenceRow('主义匹配度', r.confidence.identity.value, 'IDEOLOGY MATCH — 与主意识形态的贴合度')}
          ${confidenceRow('结果明确度', r.confidence.discrimination.value, 'RESULT CLARITY — 与第二名的区分度')}
          ${confidenceRow('回答一致性', r.confidence.measurement.value, 'ANSWER CONSISTENCY — 题量与作答一致性')}
        </div>
        ${normalismNote}
      </section>

      <section class="rsec">
        <h2 class="rsec__h">与你相近</h2>
        ${resonanceCards}
      </section>

      ${hiddenSection}

      <section class="rsec">
        <h2 class="rsec__h">与你冲突</h2>
        ${tensionCards}
      </section>

      <section class="rsec">
        <h2 class="rsec__h">完整贴合度</h2>
        <p class="mono rsec__sub">FINAL FIT · TOP 8 OF 26</p>
        <ol class="ranking">${topList}</ol>
      </section>

      ${belief}
    </div>
  </article>`;
}

function resultHero(x: Ideology, r: ResultPackage): string {
  const match = r.primary!.finalFit;
  const typeLabel = RESULT_TYPE_LABEL[r.type];
  const dual = r.type === 'dual_core' && r.dual[1]
    ? ` · 同时贴合 ${esc(bySlug(r.dual[1].slug)!.copy.nameZh)} ${r.dual[1].finalFit.toFixed(1)}`
    : '';
  return splitHero(x, {
    metaLine: `${esc(typeLabel)}${dual}`,
    match,
    note: r.normalism.tagOnly ? '同时呈现明显的 AI 常态倾向' : undefined,
    actions:
      '<button type="button" class="btn btn--hero" data-act="share">分享我的结果</button>' +
      '<button type="button" class="btn btn--hero" data-act="share-card">生成分享图</button>' +
      `<a class="btn btn--hero btn--quiet" href="#/ideology/${x.slug}">查看完整主义</a>` +
      '<button type="button" class="btn btn--hero btn--quiet" data-act="start-test">重新测试</button>',
  });
}

function lowInfoHero(r: ResultPackage): string {
  const top = r.scores[0];
  const near = top ? bySlug(top.slug)! : null;
  return `<header class="result__hero result__hero--low" style="--c:#3975FF;--f:#000000">
    <div class="result__left">
      <p class="mono result__code">LOW INFORMATION · 未定型</p>
      <h1 id="view-title" tabindex="-1" class="result__zh result__zh--low">你的 AI 世界观<br>目前仍在形成中</h1>
      <p class="result__mfzh">你的作答大量落在中间与条件式选项上，还没有形成足够清晰的立场结构。这不是错误答案——它只是说明，你更愿意让具体情境来决定选择。</p>
      <p class="mono result__meta-line">中间答案率 ${(r.meta.midRate * 100).toFixed(0)}% · 平均轴强度 ${r.meta.meanAbsAxis.toFixed(2)} · 与第二名差距 ${r.meta.topGap.toFixed(1)}</p>
      <div class="result__cta od-cluster">
        <button type="button" class="btn btn--primary btn--lg" data-act="start-test">重新测试</button>
        <a class="btn btn--lg" href="#/library">打开图鉴</a>
        <button type="button" class="btn btn--quiet btn--lg" data-act="share">分享这个结果</button>
      </div>
    </div>
    <div class="result__right">
      <div class="result__num" aria-hidden="true">??</div>
      ${near ? `<p class="mono result__meta-line">最接近：${near.code} ${esc(near.copy.nameZh)} ${top.finalFit.toFixed(1)}</p>` : ''}
    </div>
  </header>`;
}
