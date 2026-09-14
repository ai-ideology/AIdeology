import {
  ALL_AXES, CORE_AXES, EXTENDED_AXES, META_AXES,
} from '../content/types';
import type { AxisId } from '../content/types';
import {
  dimensionById, families, hiddenCopy, ideologies, type Ideology,
} from '../content';
import { esc, motifSvg, pad2 } from '../ui/dom';

interface WikiData {
  axisQuestions: Record<string, string>;
  topics: { id: string; title: string; axis: AxisId; q: string; note: string }[];
}
// Loaded via content to keep a single import surface.
import wikiJson from '../content/wiki.json';
const wiki = wikiJson as unknown as WikiData;

/** Ideologies that place themselves furthest toward each pole of an axis. */
function campsForAxis(axis: AxisId, n = 3): { high: Ideology[]; low: Ideology[] } {
  const scored = ideologies
    .map((x) => ({ x, t: x.rule.axis_targets[axis] ?? 0 }))
    .filter((o) => Math.abs(o.t) > 0.05);
  const high = [...scored].sort((a, b) => b.t - a.t).slice(0, n).map((o) => o.x);
  const low = [...scored].sort((a, b) => a.t - b.t).slice(0, n).map((o) => o.x);
  return { high, low };
}

function campChips(list: Ideology[]): string {
  return `<div class="camp__chips">${list.map((x) =>
    `<a class="camp__chip" href="#/ideology/${x.slug}" style="--c:${x.copy.color};--f:${x.copy.fg}">${esc(x.copy.nameZh)}</a>`,
  ).join('')}</div>`;
}

function axisCard(id: AxisId): string {
  const d = dimensionById.get(id)!;
  const q = wiki.axisQuestions[id] ?? '';
  return `<article class="waxis">
    <header class="waxis__head">
      <span class="mono waxis__code">${d.id}</span>
      <h3 class="waxis__name">${esc(d.name)}</h3>
    </header>
    <p class="waxis__q">${esc(q)}</p>
    <div class="waxis__poles">
      <span class="waxis__pole waxis__pole--low">${esc(d.left)}</span>
      <span class="waxis__axis" aria-hidden="true"></span>
      <span class="waxis__pole waxis__pole--high">${esc(d.right)}</span>
    </div>
  </article>`;
}

function topicBlock(t: WikiData['topics'][number], i: number): string {
  const d = dimensionById.get(t.axis)!;
  const { high, low } = campsForAxis(t.axis);
  const camp = (pole: string, list: Ideology[], highSide: boolean) =>
    list.length
      ? `<div class="camp${highSide ? ' camp--high' : ''}">
          <p class="camp__label mono">${esc(pole)}</p>
          ${campChips(list)}
        </div>`
      : '';
  return `<article class="topic">
    <div class="topic__num mono">${pad2(i + 1)}</div>
    <div class="topic__body">
      <h3 class="topic__title">${esc(t.title)}</h3>
      <p class="topic__q">${esc(t.q)}</p>
      <p class="topic__note">${esc(t.note)}</p>
      <div class="topic__axis mono">${esc(d.id)} · ${esc(d.name)}</div>
      <div class="camps">
        ${camp(d.left, low, false)}
        ${camp(d.right, high, true)}
      </div>
    </div>
  </article>`;
}

function familyBlock(key: string): string {
  const f = families.find((x) => x.zh === key)!;
  const list = ideologies.filter((x) => x.copy.family === key);
  return `<div class="wfam">
    <header class="wfam__head">
      <h3 class="wfam__name">${esc(f.zh)}</h3>
      <span class="mono wfam__en">${esc(f.en)}</span>
    </header>
    <ul class="wfam__list">${list.map((x) =>
      `<li><a class="wfam__item" href="#/ideology/${x.slug}"><span class="wfam__dot" style="background:${x.copy.color}" aria-hidden="true"></span>${esc(x.copy.nameZh)}<span class="mono wfam__code">${x.code}</span></a></li>`,
    ).join('')}</ul>
  </div>`;
}

export function renderWiki(): string {
  const familiesOrder = families.map((f) => f.zh);

  const axisCards = ALL_AXES.map(axisCard).join('');
  const topics = wiki.topics.map(topicBlock).join('');

  const hiddenNames = hiddenCopy.map((h) =>
    `<article class="hcard" style="--c:${h.color ?? '#0A0A0A'};--f:${h.fg ?? '#FFFFFF'}">
      <span class="hcard__emblem" aria-hidden="true">${motifSvg(h.motif ?? 'axis')}</span>
      <div class="hcard__b">
        <h3 class="hcard__h">${esc(h.nameZh)}</h3>
        <p class="mono hcard__en">${esc(h.nameEn)}</p>
        ${h.nickname ? `<p class="hcard__nick">「${esc(h.nickname)}」</p>` : ''}
        <p class="hcard__p">${esc(h.summary)}</p>
      </div>
    </article>`,
  ).join('');

  const layers = [
    { k: 'L1', t: '未来信念 · 世界会怎样', p: 'AI 会发展到什么程度、会不会带来大规模失业、是否可能出现数字意识、文明级灾难的概率有多大。' },
    { k: 'L2', t: '核心价值 · 什么值得保留', p: '进步、安全、人的主体性、自由、平等、真实性、生态边界——当它们冲突时，谁优先。' },
    { k: 'L3', t: '制度立场 · 谁控制、谁分配', p: '智能归资本、国家、公众、开源社区，还是 AI 自身；收益又该怎么分。' },
    { k: 'L4', t: '行动主张 · 现在怎么办', p: '加速、监管、开放、限制，以及国家之间合作还是竞争。' },
  ].map((l) => `<div class="layer">
    <span class="mono layer__k">${l.k}</span>
    <h3 class="layer__t">${esc(l.t)}</h3>
    <p class="layer__p">${esc(l.p)}</p>
  </div>`).join('');

  const pipeline = [
    { n: '01', t: '48 道核心题', p: '每题直接落在一到两条价值轴上，得到 15 条轴 + AI 显著性的读数。' },
    { n: '02', t: '中性基线贴合', p: '用 AxisFit 计算你与 26 个原型的距离，并扣除「全中间作答」的天然相似度。' },
    { n: '03', t: '6–10 道判别题', p: '在你最接近的几个原型之间，动态追问最能区分它们的问题。' },
    { n: '04', t: '信条与反证', p: '用 Hallmark 确认核心信条是否真的出现，并用反证扣分，避免误判。' },
    { n: '05', t: '输出档案', p: '得到主意识形态 / 双核心 / 混合型 / 未定型，以及三重可信度与可能的隐藏徽章。' },
  ].map((s) => `<li class="step">
    <span class="mono step__n">${s.n}</span>
    <div class="step__b"><h3 class="step__t">${esc(s.t)}</h3><p class="step__p">${esc(s.p)}</p></div>
  </li>`).join('');

  return `<section class="wiki">
    <header class="wiki__hero">
      <p class="mono tag-line">DESIGN WIKI</p>
      <h1 id="view-title" tabindex="-1" class="wiki__title">这个测试<br>是怎么设计的</h1>
      <p class="wiki__lead">AIdeology 不测「你支不支持 AI」，而是测量你在 AI 未来问题上的稳定世界观。同一个技术事实，可以有完全不同的立场——这个页面把那些分歧摊开给你看。</p>
      <p class="mono wiki__meta">26 IDEOLOGIES · 16 AXES · 48 CORE ITEMS · 8 HIDDEN STANCES</p>
    </header>

    <div class="wiki__body">
      <section class="wsec">
        <h2 class="wsec__h">两个层次：信念与立场</h2>
        <p class="wsec__p">测这份测试时，最容易混淆的是两件事：<b>你认为未来会发生什么</b>（事实信念），和 <b>你认为未来应该怎样</b>（价值立场）。</p>
        <div class="wcontrast">
          <div class="wcontrast__i">
            <p class="mono wcontrast__tag">事实信念</p>
            <p class="wcontrast__q">「未来二十年，AI 可能替代一半的工作。」</p>
            <p class="wcontrast__note">这是一个预测，可以被数据检验。</p>
          </div>
          <div class="wcontrast__i wcontrast__i--alt">
            <p class="mono wcontrast__tag">价值立场</p>
            <p class="wcontrast__q">「如果 AI 真能替代一半工作，我们应该让企业快速完成替代。」</p>
            <p class="wcontrast__note">这是一个规范判断，无法用数据单独证明。</p>
          </div>
        </div>
        <p class="wsec__p">两个人可以对同一个事实有共识，却因为价值排序不同而得出相反结论。主意识形态由价值立场为主、事实信念为辅共同决定。</p>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">四层世界观模型</h2>
        <p class="wsec__p">一个人的立场不是一条轴上的点，而是四个层次叠起来的结果。</p>
        <div class="layers">${layers}</div>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">价值坐标：16 个真正有分歧的问题</h2>
        <p class="wsec__p">下面是这套测试使用的全部维度。每一条都是一道没有标准答案的开放问题——两个方向都有严肃的理由，也有真实的人站在两端。</p>
        <div class="waxes">${axisCards}</div>
        <p class="mono waxis__legend">${CORE_AXES.length} 核心轴 · ${EXTENDED_AXES.length} 扩展轴 · ${META_AXES.length} 元轴</p>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">分歧地图</h2>
        <p class="wsec__p">把维度还原成真实争论，就成了下面这张地图。每个议题下面，是当前更靠近两端立场的主义——你会在测试结果里看到自己落在哪一边。</p>
        <div class="topics">${topics}</div>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">26 种立场，5 个谱系</h2>
        <p class="wsec__p">这些分歧组合起来，形成 26 种稳定的立场原型。它们按关注的核心问题分为五个谱系，每一种都有自己的详细介绍页。</p>
        <div class="wfams">${familiesOrder.map(familyBlock).join('')}</div>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">8 个隐藏立场</h2>
        <p class="wsec__p">还有 8 种更稀有的边界立场。它们不参与普通比较，只有当你同时满足「明显的价值前置」和「专题题的明确支持」时才会被点亮，最多显示两个，且不会替代你的主意识形态。它们没有角色插画，在结果页以带色块的徽章呈现。</p>
        <div class="wchips">${hiddenNames}</div>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">它是怎么算出结果的</h2>
        <p class="wsec__p">测试不是把所有答案加总取最高分，而是一条有层次的判别流程。</p>
        <ol class="steps">${pipeline}</ol>
        <div class="wtypes">
          ${[
            { t: '主意识形态', p: '有一个立场明显最贴近，且核心信条成立。' },
            { t: '双核心', p: '两个立场几乎并肩贴合，且各自信条都成立。' },
            { t: '混合型', p: '多个立场都贴近，但证据不足以确定单一身份。' },
            { t: '未定型', p: '作答大量落在中间与条件式选项，立场仍在形成中。' },
          ].map((x) => `<div class="wtype"><h3 class="wtype__t">${esc(x.t)}</h3><p class="wtype__p">${esc(x.p)}</p></div>`).join('')}
        </div>
        <p class="wsec__p">这也意味着：输出「混合型」或「未定型」不是失败，而是这份测试刻意保留的诚实——宁可承认分不清，也不硬塞一个标签。</p>
      </section>

      <section class="wsec">
        <h2 class="wsec__h">命名体系</h2>
        <p class="wsec__p">每个立场有三层名字，分别服务不同场合：</p>
        <div class="wname">
          <div class="wname__i"><p class="mono wname__k">正式名称</p><p class="wname__v">智能公共主义</p><p class="wname__u">用于结果标题、理论说明与长文分享。</p></div>
          <div class="wname__i"><p class="mono wname__k">短名称</p><p class="wname__v">智能公共</p><p class="wname__u">用于列表、谱系节点与小尺寸卡片。</p></div>
          <div class="wname__i"><p class="mono wname__k">传播昵称</p><p class="wname__v">全民AI派</p><p class="wname__u">用于揭晓、徽章与社交媒体，一眼能懂。</p></div>
        </div>
        <p class="wsec__p">词根也不是随手选的：<b>AI</b> 指向现实技术与政策对象，<b>智能</b> 指向抽象能力与文明基础设施，<b>机器</b> 指向与人相对的智能主体，<b>数字</b> 指向数字存在与制度，<b>人类</b> 指向人的主体性。</p>
      </section>

      <section class="wsec wsec--end">
        <h2 class="wsec__h">边界与局限</h2>
        <ul class="wlimits">
          <li>它不是政治考试，也没有标准答案；测的是立场，不是对错。</li>
          <li>它不假设每个人都该有一个清晰的标签，因此保留混合与未定型。</li>
          <li>它不是 MBTI 的换皮：维度来自 AI 议题本身，而不是通用人格模型。</li>
          <li>当前版本是 v1 正式冻结版；下一阶段是真实匿名数据，再据做统计校准。</li>
        </ul>
        <div class="od-cluster wsec__cta">
          <button type="button" class="btn btn--primary btn--lg" data-act="start-test">开始测试</button>
          <a class="btn btn--lg" href="#/library">打开图鉴</a>
          <a class="btn btn--lg" href="#/atlas">在谱系中漫游</a>
        </div>
      </section>
    </div>
  </section>`;
}
