import './styles/primitives.css';
import './styles/app.css';
import { hiddenRules, ideologies } from './content';
import { axisScores, computeResult, planAdaptive, RESULT_TYPE_LABEL, scoreItems } from './scoring/engine';
import { clearState, getState, resetState, setState, type SessionState } from './app/store';
import { decodeShare, shareText, shareUrl } from './app/share';
import { renderLanding } from './views/landing';
import { renderTest, currentQuestion } from './views/test';
import { renderResult, renderResultEmpty } from './views/result';
import { renderLibrary, libraryCountText, libraryGridHtml, type LibraryState } from './views/library';
import { renderDetail } from './views/detail';
import { atlasPanelHtml, atlasIntroHtml, atlasTipHtml, renderAtlas } from './views/atlas';
import { drawShareCard, renderShare, renderShareError } from './views/share';

const APP = document.getElementById('app') as HTMLElement;
const TOAST = document.getElementById('toast') as HTMLElement;
const ANNOUNCER = document.getElementById('route-announcer') as HTMLElement;

const TITLES: Record<string, string> = {
  landing: '首页', test: '测试', computing: '计算中', result: '我的结果',
  library: '意识形态图鉴', detail: '主义详情', atlas: '意识形态谱系', share: '分享结果',
};

const lib: LibraryState = { family: 'all', query: '' };
let modal: HTMLElement | null = null;
let lastShareText = '';
let timers: number[] = [];

/* ---------- routing ---------- */

type Route =
  | { view: 'landing' }
  | { view: 'test' }
  | { view: 'computing' }
  | { view: 'result' }
  | { view: 'library' }
  | { view: 'atlas' }
  | { view: 'detail'; slug: string }
  | { view: 'share'; data: string | null };

function parseHash(): Route {
  const raw = (window.location.hash || '#/').replace(/^#\/?/, '');
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const query = qi >= 0 ? raw.slice(qi + 1) : '';
  const [name, arg] = path.split('/');
  if (name === 'ideology' && arg) return { view: 'detail', slug: decodeURIComponent(arg) };
  if (name === 'share') {
    const m = /(?:^|&)d=([^&]+)/.exec(query);
    return { view: 'share', data: m ? m[1] : null };
  }
  if (name === 'test' || name === 'computing' || name === 'result' || name === 'library' || name === 'atlas') {
    return { view: name };
  }
  return { view: 'landing' };
}

function go(hash: string): void {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

/* ---------- test flow ---------- */

function beginTest(): void {
  resetState();
  setState({ startedAt: Date.now() });
  go('#/test');
}

function setAnswer(kind: 'core' | 'adaptive' | 'hidden', id: string, index: number): void {
  const s = getState();
  const answers = { ...s.answers, [kind]: { ...s.answers[kind], [id]: index } };
  setState({ answers });
  paintQuestion();
}

function skipQuestion(): void {
  const s = getState();
  const q = currentQuestion(s);
  if (!q || !q.canSkip) { step(1); return; }
  const answers = { ...s.answers, [q.kind]: { ...s.answers[q.kind] } };
  delete (answers[q.kind] as Record<string, number>)[q.id];
  setState({ answers });
  step(1);
}

function step(delta: number): void {
  const s = getState();
  const q = currentQuestion(s);
  if (!q) return;
  const next = q.stepIndex + delta;
  if (next < 0) return;
  if (next >= q.total) { advanceStep(s); return; }
  if (s.step === 'core') setState({ coreIndex: next });
  else if (s.step === 'adaptive') setState({ adaptiveIndex: next });
  else setState({ hiddenIndex: next });
  paintQuestion();
}

function advanceStep(s: SessionState): void {
  if (s.step === 'core') {
    const axes = axisScores(scoreItems(s.answers));
    const plan = planAdaptive(axes);
    setState({ step: 'adaptive', adaptiveIndex: 0, adaptivePlan: plan.itemIds });
    go('#/test');
    return;
  }
  if (s.step === 'adaptive') {
    // Compute cheaply first to decide whether hidden topic items are warranted.
    const plan = decideHidden(s);
    if (plan.length) {
      setState({ step: 'hidden', hiddenIndex: 0, hiddenPlan: plan });
      go('#/test');
      return;
    }
    finishTest();
    return;
  }
  finishTest();
}

function decideHidden(s: SessionState): string[] {
  // Pre-screen hidden rules cheaply: ask the topic items for any rule whose
  // prerequisites nearly hold, so the engine can then confirm the badge.
  const axes = axisScores(scoreItems(s.answers));
  const result = computeResult(s.answers);
  const candidates = new Set<string>();
  for (const rule of hiddenRules) {
    const pre = rule.prerequisites as Record<string, any>;
    let close = true;
    for (const [key, val] of Object.entries(pre)) {
      if (key === 'prototype' || key === 'prototype_fit_min') continue;
      const v = (axes as Record<string, number>)[key] ?? 0;
      if (val && typeof val === 'object' && 'min' in val) {
        if (v < val.min - 0.12) close = false;
      } else if (val && typeof val === 'object' && 'max' in val) {
        if (v > val.max + 0.12) close = false;
      }
    }
    if (pre.prototype) {
      const fit = result.scores.find((x) => x.slug === pre.prototype)?.finalFit ?? 0;
      if (fit < (pre.prototype_fit_min ?? 0) - 8) close = false;
    }
    if (close) for (const id of rule.items) candidates.add(id);
  }
  return [...candidates].slice(0, 4);
}

function finishTest(): void {
  const s = getState();
  const result = computeResult(s.answers);
  setState({ result, step: 'core' });
  go('#/computing');
}

/* ---------- computing ---------- */

function afterComputing(): void {
  const box = document.querySelector('.computing');
  if (box) box.classList.add('is-run');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  timers.push(window.setTimeout(() => go('#/result'), reduce ? 1200 : 3400));
}

/* ---------- render ---------- */

function paintQuestion(): void {
  const q = currentQuestion();
  if (!q) { renderTest(); paintApp(renderTest()); return; }
  const opts = document.querySelectorAll('#test-opts .opt');
  opts.forEach((el, i) => {
    const on = q.selected === i;
    el.classList.toggle('is-selected', on);
    el.setAttribute('aria-pressed', String(on));
    const mark = el.querySelector('.opt__mark');
    if (mark) mark.textContent = on ? '■' : '';
  });
  const nxt = document.querySelector<HTMLButtonElement>('[data-act="next"]');
  if (nxt) nxt.disabled = q.selected === null;
}

function paintApp(html: string): void {
  APP.innerHTML = html;
}

function render(): void {
  timers.forEach((t) => window.clearTimeout(t));
  timers = [];
  closeModal();
  const route = parseHash();

  if (route.view === 'computing' && !getState().result) { go('#/test'); return; }
  if (route.view === 'detail') {
    const html = renderDetail(route.slug);
    if (!html) { go('#/library'); return; }
    paintApp(html);
  } else if (route.view === 'landing') {
    paintApp(renderLanding());
  } else if (route.view === 'test') {
    paintApp(renderTest());
  } else if (route.view === 'computing') {
    paintApp(renderComputing());
  } else if (route.view === 'result') {
    const r = getState().result;
    paintApp(r ? renderResult(r) : renderResultEmpty());
  } else if (route.view === 'library') {
    paintApp(renderLibrary(lib));
    updateLibCount();
  } else if (route.view === 'atlas') {
    paintApp(renderAtlas());
    afterAtlas();
  } else {
    // share
    if (!route.data) { paintApp(renderShareError()); }
    else {
      const payload = decodeShare(route.data);
      paintApp(payload ? renderShare(payload) : renderShareError());
    }
  }

  document.body.setAttribute('data-view', route.view);
  document.title = `${TITLES[route.view] ?? 'AIdeology'} · AIdeology`;
  syncNav(route.view);
  window.scrollTo(0, 0);
  ANNOUNCER.textContent = `已进入${TITLES[route.view] ?? ''}页面`;
  const title = document.getElementById('view-title');
  try { title?.focus({ preventScroll: true }); } catch { title?.focus(); }

  if (route.view === 'computing') afterComputing();
}

function renderComputing(): string {
  const steps = [
    '01 ANALYZE VECTOR', '02 NORMALIZE AXES', '03 MATCH IDEOLOGIES',
    '04 FIND RESONANCE', '05 BUILD WORLDVIEW',
  ];
  return `<section class="computing"><div class="computing__box">
    <p class="mono tag-line">COMPUTING</p>
    <h1 id="view-title" tabindex="-1" class="computing__h">正在计算你的意识形态</h1>
    <p class="computing__sub">48 道核心题正在被压缩成 16 条轴读数，再与 26 种未来逐一比对，并用判别题确认。</p>
    <ol class="computing__steps">${steps.map((s, i) => {
      const [no, ...rest] = s.split(' ');
      return `<li class="computing__step" style="--d:${i * 480}ms">
        <span class="mono computing__no">${no}</span><span class="mono computing__label">${rest.join(' ')}</span></li>`;
    }).join('')}</ol>
    <div class="computing__bar"><span class="computing__fill"></span></div>
    <button type="button" class="btn computing__skip" data-act="to-result">跳过动画 →</button>
  </div></section>`;
}

function syncNav(view: string): void {
  const key = view === 'detail' ? 'library' : view === 'computing' ? 'test' : view === 'share' ? 'result' : view;
  document.querySelectorAll<HTMLAnchorElement>('.site-nav a[data-nav]').forEach((a) => {
    const on = a.dataset.nav === key;
    a.classList.toggle('is-on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function updateLibCount(): void {
  const el = document.getElementById('lib-count');
  if (el) el.textContent = libraryCountText(lib);
}

/* ---------- atlas ---------- */

function afterAtlas(): void {
  const svg = document.getElementById('atlas-svg');
  const wrap = document.getElementById('atlas-wrap');
  const tip = document.getElementById('atlas-tip');
  if (!svg || !wrap || !tip) return;
  const nodeOf = (t: EventTarget | null) =>
    t instanceof Element ? (t.closest('.anode') as SVGGElement | null) : null;
  const bySlug = (slug: string) => ideologies.find((x) => x.slug === slug)!;

  const showTip = (g: SVGGElement) => {
    const x = bySlug(g.dataset.slug!);
    tip.innerHTML = atlasTipHtml(x);
    tip.hidden = false;
    const wr = wrap.getBoundingClientRect();
    const nr = g.getBoundingClientRect();
    let left = nr.left - wr.left + nr.width / 2;
    left = Math.max(110, Math.min(wr.width - 110, left));
    tip.style.left = `${left}px`;
    tip.style.top = `${nr.top - wr.top - 10}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  const select = (g: SVGGElement) => {
    const slug = g.dataset.slug!;
    const near = new Set<number>();
    (window as any).__near = bySlug(slug);
    const nearSlugs = new Set(nearestSlugs(slug));
    svg.querySelectorAll<SVGGElement>('.anode').forEach((n) => {
      const s = n.dataset.slug!;
      n.classList.toggle('is-selected', s === slug);
      n.classList.toggle('is-near', s !== slug && nearSlugs.has(s));
      n.classList.toggle('is-dim', s !== slug && !nearSlugs.has(s));
    });
    svg.querySelectorAll('.aedge').forEach((e) => e.classList.add('is-dim'));
    const panel = document.getElementById('atlas-panel');
    if (panel) panel.innerHTML = atlasPanelHtml(bySlug(slug));
    void near;
  };

  svg.addEventListener('mouseover', (e) => { const g = nodeOf(e.target); if (g) showTip(g); });
  svg.addEventListener('mouseout', (e) => {
    const g = nodeOf(e.target);
    if (g && !(e.relatedTarget instanceof Node && g.contains(e.relatedTarget))) hideTip();
  });
  svg.addEventListener('focusin', (e) => { const g = nodeOf(e.target); if (g) showTip(g); });
  svg.addEventListener('focusout', hideTip);
  svg.addEventListener('click', (e) => { const g = nodeOf(e.target); if (g) select(g); });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = nodeOf(e.target);
    if (g) { e.preventDefault(); select(g); }
  });
}

function nearestSlugs(slug: string): string[] {
  const x = ideologies.find((i) => i.slug === slug)!;
  const t = x.rule.axis_targets;
  return ideologies
    .filter((y) => y.slug !== slug)
    .map((y) => {
      const u = y.rule.axis_targets;
      const keys = new Set<string>([...Object.keys(t), ...Object.keys(u)]);
      let d = 0;
      for (const k of keys) d += Math.abs(((t as any)[k] ?? 0) - ((u as any)[k] ?? 0));
      return { slug: y.slug, d };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)
    .map((o) => o.slug);
}

function clearNode(): void {
  const svg = document.getElementById('atlas-svg');
  if (svg) {
    svg.querySelectorAll('.anode').forEach((n) => n.classList.remove('is-selected', 'is-near', 'is-dim'));
    svg.querySelectorAll('.aedge').forEach((e) => e.classList.remove('is-dim'));
  }
  const panel = document.getElementById('atlas-panel');
  if (panel) panel.innerHTML = atlasIntroHtml();
}

/* ---------- share ---------- */

function toast(message: string): void {
  if (!TOAST) return;
  TOAST.textContent = message;
  TOAST.classList.add('is-on');
  window.clearTimeout((toast as any)._t);
  (toast as any)._t = window.setTimeout(() => TOAST.classList.remove('is-on'), 2400);
}

function openShare(): void {
  const r = getState().result;
  if (!r || !r.primary) { toast('先完成测试再分享'); return; }
  const x = ideologies.find((i) => i.slug === r.primary!.slug)!;
  lastShareText = shareText(r, x.copy.nameZh, x.code, r.type === 'low_information' ? '' : x.copy.manifestoZh, r.primary.finalFit);
  closeModal();
  modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal__back" data-act="close-modal"></div>
    <div class="modal__box" role="dialog" aria-modal="true" aria-label="分享我的结果">
      <div class="modal__head od-row"><h2 class="modal__title">分享我的结果</h2>
      <button type="button" class="modal__x" data-act="close-modal" aria-label="关闭">×</button></div>
      <pre class="modal__text" id="share-text"></pre>
      <div class="modal__cta od-cluster">
        <button type="button" class="btn btn--primary" data-act="do-copy">复制文案</button>
        <button type="button" class="btn" data-act="do-link">打开分享页</button>
        <button type="button" class="btn btn--quiet" data-act="close-modal">关闭</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const pre = document.getElementById('share-text');
  if (pre) pre.textContent = lastShareText;
  modal.querySelector<HTMLButtonElement>('[data-act="do-copy"]')?.focus();
}

function closeModal(): void {
  if (modal?.parentNode) modal.parentNode.removeChild(modal);
  modal = null;
}

async function doShareCard(): Promise<void> {
  const r = getState().result;
  if (!r || !r.primary) { toast('先完成测试再生成分享图'); return; }
  const x = ideologies.find((i) => i.slug === r.primary!.slug)!;
  const blob = await drawShareCard({
    nameZh: x.copy.nameZh, nameEn: x.copy.nameEn, code: x.code,
    manifestoZh: x.copy.manifestoZh, manifestoEn: x.copy.manifestoEn,
    color: x.copy.color, fg: x.copy.fg, match: r.primary.finalFit,
    confidence: r.confidence, typeLabel: RESULT_TYPE_LABEL[r.type],
  });
  if (!blob) { toast('生成分享图失败'); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aideology-${x.slug}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('分享图已下载');
}

function copyText(text: string, done: (ok: boolean) => void): void {
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove(); done(ok);
    } catch { done(false); }
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => done(true), fallback);
  } else fallback();
}

/* ---------- events ---------- */

APP.addEventListener('click', (e) => {
  const el = (e.target as Element | null)?.closest?.('[data-act]');
  if (!el) return;
  const act = (el as HTMLElement).dataset.act!;
  if (act === 'start-test') beginTest();
  else if (act === 'ans') setAnswer(currentQuestion()!.kind, currentQuestion()!.id, Number((el as HTMLElement).dataset.i));
  else if (act === 'prev') step(-1);
  else if (act === 'next') step(1);
  else if (act === 'skip') skipQuestion();
  else if (act === 'finish') finishTest();
  else if (act === 'to-result') go('#/result');
  else if (act === 'share') openShare();
  else if (act === 'share-card') void doShareCard();
  else if (act === 'clear-node') clearNode();
  else if (act === 'filter') {
    lib.family = (el as HTMLElement).dataset.family || 'all';
    document.querySelectorAll('.chip[data-family]').forEach((c) => {
      const on = (c as HTMLElement).dataset.family === lib.family;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const grid = document.getElementById('lib-grid');
    if (grid) grid.innerHTML = libraryGridHtml(lib);
    updateLibCount();
  } else if (act === 'reset-filter') {
    lib.family = 'all'; lib.query = '';
    const input = document.getElementById('lib-search') as HTMLInputElement | null;
    if (input) input.value = '';
    render();
  }
});

APP.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t?.id !== 'lib-search') return;
  lib.query = t.value || '';
  const grid = document.getElementById('lib-grid');
  if (grid) grid.innerHTML = libraryGridHtml(lib);
  updateLibCount();
});

document.addEventListener('click', (e) => {
  const el = (e.target as Element | null)?.closest?.('[data-act]');
  if (!el || APP.contains(el)) return;
  const act = (el as HTMLElement).dataset.act;
  if (act === 'close-modal') closeModal();
  else if (act === 'do-copy') copyText(lastShareText, (ok) => { toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择文本'); if (ok) closeModal(); });
  else if (act === 'do-link') {
    const r = getState().result;
    if (r) { navigator.clipboard?.writeText(shareUrl(r)); toast('分享链接已复制'); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); return; }
  const box = document.querySelector('.modal__box');
  if (e.key === 'Tab' && box) {
    const f = box.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    return;
  }
  if (document.body.dataset.view !== 'test') return;
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const q = currentQuestion();
  if (!q) return;
  const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, a: 0, b: 1, c: 2, d: 3, e: 4 };
  const letter = e.key.toLowerCase();
  if (letter in keyMap && keyMap[letter] < q.options.length) {
    setAnswer(q.kind, q.id, keyMap[letter]);
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); step(1); return; }
  if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); step(1); }
});

/* ---------- boot ---------- */

function init(): void {
  window.addEventListener('hashchange', render);
  if (!window.location.hash) {
    // keep an old in-progress session reachable
    const s = getState();
    if (s.result) window.location.hash = '#/result';
  }
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

export { clearState };
