import { families, ideologies, type Ideology } from '../content';
import { esc } from '../ui/dom';
import { posterHtml } from '../ui/components';

export interface LibraryState {
  family: string;
  query: string;
}

export function filterIdeologies(state: LibraryState): Ideology[] {
  const q = state.query.trim().toLowerCase();
  return ideologies.filter((x) => {
    const c = x.copy;
    if (state.family !== 'all' && c.family !== state.family) return false;
    if (!q) return true;
    const hay = `${c.nameZh} ${c.nameShort} ${c.nickname} ${c.nameEn} ${x.code} ${c.summary} ${c.keywords.join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

export function libraryGridHtml(state: LibraryState): string {
  const list = filterIdeologies(state);
  if (!list.length) {
    return `<div class="empty empty--grid">
      <p class="mono empty__code">NO MATCH</p>
      <p class="empty__p">没有找到匹配的主义。换个关键词，或者清除筛选。</p>
      <button type="button" class="btn" data-act="reset-filter">清除筛选</button>
    </div>`;
  }
  return list.map((x) => posterHtml(x)).join('');
}

export function renderLibrary(state: LibraryState): string {
  const chips = families.map((f) =>
    `<button type="button" class="chip" data-act="filter" data-family="${esc(f.zh)}" aria-pressed="${state.family === f.zh}">${esc(f.zh)}</button>`,
  ).join('');
  const all = `<button type="button" class="chip" data-act="filter" data-family="all" aria-pressed="${state.family === 'all'}">全部</button>`;

  return `<section class="lib">
    <header class="lib__head">
      <p class="mono tag-line">FUTURE IDEOLOGY POSTERS</p>
      <h1 id="view-title" tabindex="-1">26 种未来思想</h1>
      <p class="lib__sub">每一张海报是一种立场。点开任意一张，看看它如何理解 AI 与人类，以及它与哪些立场相近或冲突。</p>
    </header>
    <div class="lib__tools">
      <div class="search">
        <label class="sr-only" for="lib-search">搜索主义</label>
        <input id="lib-search" type="search" placeholder="搜索名称 / 昵称 / 关键词" value="${esc(state.query)}" autocomplete="off">
      </div>
      <div class="od-rail lib__chips" role="group" aria-label="按谱系筛选">${all}${chips}</div>
    </div>
    <p class="mono lib__count" id="lib-count"></p>
    <div class="masonry" id="lib-grid">${libraryGridHtml(state)}</div>
  </section>`;
}

export function libraryCountText(state: LibraryState): string {
  return `SHOWING ${filterIdeologies(state).length} / ${ideologies.length} IDEOLOGIES`;
}
