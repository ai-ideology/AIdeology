import { adaptiveById, coreItems, hiddenById } from '../content';
import { esc } from '../ui/dom';
import { getState, type SessionState } from '../app/store';

export interface QuestionView {
  kind: 'core' | 'adaptive' | 'hidden';
  id: string;
  code: string;
  prompt: string;
  note?: string;
  options: string[];
  index: number;       // 1-based position within the current step
  total: number;       // items in the current step
  stepIndex: number;   // 0-based within the current step
  selected: number | null;
}

export function currentQuestion(state: SessionState = getState()): QuestionView | null {
  const a = state.answers;
  if (state.step === 'core') {
    const item = coreItems[state.coreIndex];
    if (!item) return null;
    return {
      kind: 'core', id: item.id, code: item.id, prompt: item.prompt, note: item.note,
      options: item.options.map((o) => o.label),
      index: state.coreIndex + 1, total: coreItems.length, stepIndex: state.coreIndex,
      selected: a.core[item.id] ?? null,
    };
  }
  if (state.step === 'adaptive') {
    const id = state.adaptivePlan[state.adaptiveIndex];
    const item = id ? adaptiveById.get(id) : undefined;
    if (!item) return null;
    return {
      kind: 'adaptive', id: item.id, code: `DISCRIMINANT · ${item.id}`, prompt: item.prompt,
      options: item.options.map((o) => o.label),
      index: state.adaptiveIndex + 1, total: state.adaptivePlan.length, stepIndex: state.adaptiveIndex,
      selected: a.adaptive[item.id] ?? null,
    };
  }
  const id = state.hiddenPlan[state.hiddenIndex];
  const item = id ? hiddenById.get(id) : undefined;
  if (!item) return null;
  return {
    kind: 'hidden', id: item.id, code: `SPECIAL · ${item.id}`, prompt: item.prompt,
    options: item.options.map((o) => o.label),
    index: state.hiddenIndex + 1, total: state.hiddenPlan.length, stepIndex: state.hiddenIndex,
    selected: a.hidden[item.id] ?? null,
  };
}

const STEP_LABEL: Record<string, string> = {
  core: '核心题',
  adaptive: '判别题',
  hidden: '专题题',
};

/** Shown once before the first question. */
export function renderIntro(): string {
  return `<section class="test test--intro">
    <p class="mono tag-line">BEFORE YOU START</p>
    <h1 id="view-title" tabindex="-1" class="test__q">先凭第一感觉作答</h1>
    <p class="test__lead">这不是考试，没有标准答案。请按当下最真实的第一反应选择，而不是你认为「应该」选的那一个。犹豫太久反而会失真。</p>
    <ol class="intro-list">
      <li class="intro-i"><span class="mono intro-i__n">01</span><p class="intro-i__p">48 道核心情景题，随后会有 6–10 道根据你坐标动态生成的判别题。</p></li>
      <li class="intro-i"><span class="mono intro-i__n">02</span><p class="intro-i__p">每题只有一个更接近你的选项，选定后会自动进入下一题。</p></li>
      <li class="intro-i"><span class="mono intro-i__n">03</span><p class="intro-i__p">想改就直接点「上一题」返回，进度会自动保留，可以分次完成。</p></li>
      <li class="intro-i"><span class="mono intro-i__n">04</span><p class="intro-i__p">没有时间限制；选一个最像你的，不必兼顾所有立场。</p></li>
    </ol>
    <div class="test__nav">
      <button type="button" class="btn btn--primary btn--lg" data-act="start-questions">开始答题 →</button>
      <a class="btn btn--quiet btn--lg" href="#/library">先看图鉴</a>
    </div>
    <p class="test__hint mono">凭直觉 · 没有对错 · 可随时返回修改</p>
  </section>`;
}

export function renderTest(state: SessionState = getState()): string {
  const q = currentQuestion(state);
  if (!q) {
    return `<section class="test">
      <h1 id="view-title" tabindex="-1" class="test__q">题目已全部作答</h1>
      <p class="test__hint mono">准备生成结果</p>
      <div class="test__nav"><button type="button" class="btn btn--primary" data-act="finish">查看结果 →</button></div>
    </section>`;
  }

  const pct = (q.index / q.total) * 100;
  const opts = q.options.map((label, i) =>
    `<button type="button" class="opt${q.selected === i ? ' is-selected' : ''}" data-act="ans" data-i="${i}" aria-pressed="${q.selected === i}">` +
      `<span class="opt__key mono">${'ABCDE'.charAt(i)}</span>` +
      `<span class="opt__text">${esc(label)}</span>` +
      `<span class="opt__mark" aria-hidden="true">${q.selected === i ? '■' : ''}</span>` +
    `</button>`,
  ).join('');

  const nextLabel = q.stepIndex === q.total - 1
    ? (state.step === 'core' ? '进入判别题' : '提交并查看结果')
    : '下一题';

  return `<section class="test">
    <div class="test__meta mono" id="test-meta">${esc(q.code)} · ${esc(STEP_LABEL[q.kind])} ${q.index} / ${q.total}</div>
    <div class="progress" id="test-progress" role="progressbar" aria-label="测试进度" aria-valuemin="1" aria-valuemax="${q.total}" aria-valuenow="${q.index}">
      <span class="progress__fill" id="test-bar-fill" style="width:${pct.toFixed(1)}%"></span>
    </div>
    <h1 id="view-title" tabindex="-1" class="test__q">${esc(q.prompt)}</h1>
    ${q.note ? `<p class="test__note mono">${esc(q.note)}</p>` : ''}
    <div class="test__opts" id="test-opts">${opts}</div>
    <div class="test__nav">
      <button type="button" class="btn" data-act="prev"${q.stepIndex === 0 && state.step === 'core' ? ' disabled' : ''}>← 上一题</button>
      <button type="button" class="btn btn--primary" data-act="next">${esc(nextLabel)}</button>
    </div>
    <p class="test__hint mono">键盘：A–E / 1–5 选择（选完自动下一题）· ← → 翻题</p>
  </section>`;
}
