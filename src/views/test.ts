import { adaptiveById, coreItems, hiddenById } from '../content';
import { esc } from '../ui/dom';
import { getState, type SessionState } from '../app/store';

export interface QuestionView {
  kind: 'core' | 'adaptive' | 'hidden';
  id: string;
  code: string;
  scenario?: string;
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
      kind: 'core', id: item.id, code: item.id, scenario: item.scenario,
      prompt: item.prompt, note: item.note,
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
      kind: 'adaptive', id: item.id, code: `DISCRIMINANT · ${item.id}`, scenario: item.scenario,
      prompt: item.prompt,
      options: item.options.map((o) => o.label),
      index: state.adaptiveIndex + 1, total: state.adaptivePlan.length, stepIndex: state.adaptiveIndex,
      selected: a.adaptive[item.id] ?? null,
    };
  }
  const id = state.hiddenPlan[state.hiddenIndex];
  const item = id ? hiddenById.get(id) : undefined;
  if (!item) return null;
  return {
    kind: 'hidden', id: item.id, code: `SPECIAL · ${item.id}`, scenario: item.scenario,
    prompt: item.prompt,
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
    <h1 id="view-title" tabindex="-1" class="test__q">凭第一感觉作答</h1>
    <p class="test__lead">没有标准答案，也没有时间限制，按第一反应选择即可，可随时返回修改。</p>
    <div class="test__nav">
      <button type="button" class="btn btn--primary btn--lg" data-act="start-questions">开始答题 →</button>
      <a class="btn btn--quiet btn--lg" href="#/library">先看图鉴</a>
    </div>
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
    ${q.scenario ? `<p class="test__scenario"><span class="mono test__scenario-tag">情景</span>${esc(q.scenario)}</p>` : ''}
    <h1 id="view-title" tabindex="-1" class="test__q test__q--question">${esc(q.prompt)}</h1>
    ${q.note ? `<p class="test__note mono">${esc(q.note)}</p>` : ''}
    <div class="test__opts" id="test-opts">${opts}</div>
    <div class="test__nav">
      <button type="button" class="btn" data-act="prev"${q.stepIndex === 0 && state.step === 'core' ? ' disabled' : ''}>← 上一题</button>
      <button type="button" class="btn btn--primary" data-act="next">${esc(nextLabel)}</button>
    </div>
    <p class="test__hint mono">键盘：A–E / 1–5 选择（选完自动下一题）· ← → 翻题</p>
  </section>`;
}
