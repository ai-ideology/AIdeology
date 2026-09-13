import { ideologies } from '../content';
import { esc } from '../ui/dom';
import { posterHtml } from '../ui/components';

const FEATURED = ['promethean', 'pause', 'digital-life', 'intelligence-commons', 'arms-race', 'open-intelligence'];

export function renderLanding(): string {
  const preview = FEATURED
    .map((slug) => ideologies.find((x) => x.slug === slug)!)
    .map((x) => posterHtml(x))
    .join('');

  const conflict = [
    { key: 'ACCELERATE', zh: '加速', slug: 'promethean' },
    { key: 'PAUSE', zh: '暂停', slug: 'pause' },
    { key: 'COMMONS', zh: '公共', slug: 'intelligence-commons' },
    { key: 'HUMAN FIRST', zh: '人本', slug: 'human-primacy' },
    { key: 'DIGITAL LIFE', zh: '数字生命', slug: 'digital-life' },
    { key: 'OPEN', zh: '开放', slug: 'open-intelligence' },
    { key: 'CONTROL', zh: '管制', slug: 'controlled-intelligence' },
  ].map((b, i) => {
    const c = ideologies.find((x) => x.slug === b.slug)!.copy;
    return `<div class="cf__b cf__b--${i + 1}" style="--c:${c.color};--f:${c.fg}">` +
      `<span class="cf__en mono">${esc(b.key)}</span><span class="cf__zh">${esc(b.zh)}</span></div>`;
  }).join('');

  const marquee = ideologies.map((x) =>
    `<span class="mq__item"><b class="mono">${x.code}</b>${esc(x.copy.nameZh)}</span><span class="mq__dot" aria-hidden="true">■</span>`,
  ).join('');

  return `<section class="landing">
    <div class="hero">
      <div class="hero__main">
        <p class="mono tag-line">26 POSSIBLE FUTURES</p>
        <h1 id="view-title" tabindex="-1" class="hero__title">当 AI 不再只是工具，<br>你站在哪一边？</h1>
        <p class="hero__sub">48 道核心情景题，15 条价值轴 + AI 显著性，26 种关于 AI 未来的立场。没有标准答案，只有你选择的世界。</p>
        <div class="hero__cta od-cluster">
          <button type="button" class="btn btn--primary btn--xl" data-act="start-test">开始测试 <span aria-hidden="true">→</span></button>
          <a class="btn btn--xl" href="#/library">探索意识形态谱系</a>
        </div>
        <p class="mono hero__meta">48 SCENARIOS · 16 AXES · 26 IDEOLOGIES · 8 HIDDEN STANCES</p>
      </div>
      <div class="hero__field" aria-hidden="true"><div class="cf">${conflict}</div></div>
    </div>

    <section class="stats" aria-label="系统规模">
      <div class="stats__i od-stat"><span class="stats__n">26</span><span class="mono stats__l">IDEOLOGIES</span></div>
      <div class="stats__i od-stat"><span class="stats__n">48</span><span class="mono stats__l">CORE ITEMS</span></div>
      <div class="stats__i od-stat"><span class="stats__n">16</span><span class="mono stats__l">AXES</span></div>
      <div class="stats__i od-stat"><span class="stats__n">08</span><span class="mono stats__l">HIDDEN STANCES</span></div>
    </section>

    <section class="how">
      <header class="sec-head"><h2 class="sec-title">怎么玩</h2><span class="mono sec-tag">3 STEPS</span></header>
      <ol class="how__list">
        <li class="how__i"><span class="how__n mono">01</span><h3 class="how__h">回答 48 个核心情景</h3><p class="how__p">没有对错。每题选一个更接近你的答案，选定后会立即进入下一题。</p></li>
        <li class="how__i"><span class="how__n mono">02</span><h3 class="how__h">动态追问 6–10 题</h3><p class="how__p">系统根据你的坐标，从 24 道近邻判别题里挑出最能区分你的那几题。</p></li>
        <li class="how__i"><span class="how__n mono">03</span><h3 class="how__h">遇见你的意识形态</h3><p class="how__p">26 种未来中，与你最接近的那一种会以海报的形式揭晓；稀有立场还会点亮隐藏徽章。</p></li>
      </ol>
    </section>

    <section class="featured">
      <header class="sec-head"><h2 class="sec-title">部分立场预览</h2><a class="mono link" href="#/library">查看全部 26 种 →</a></header>
      <div class="featured__grid">${preview}</div>
    </section>

    <div class="marquee" aria-hidden="true"><div class="marquee__track">${marquee}${marquee}</div></div>

    <section class="cta-end">
      <p class="mono tag-line">STRUCTURE NEUTRAL · IDEOLOGY EXPRESSIVE</p>
      <h2 class="cta-end__h">不同思想，<br>争夺不同的未来。</h2>
      <div class="od-cluster cta-end__cta">
        <button type="button" class="btn btn--primary btn--xl" data-act="start-test">开始测试 →</button>
        <a class="btn btn--xl" href="#/atlas">在谱系中漫游</a>
      </div>
    </section>
  </section>`;
}
