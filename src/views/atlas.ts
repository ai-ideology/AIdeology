import { ideologies, nearestIdeologies, type Ideology } from '../content';
import { esc, motifInner, motifSvg } from '../ui/dom';

const W = 1000;
const H = 640;

interface Node { x: Ideology; cx: number; cy: number; }

/** Place each ideology by its own axis targets: x = progress speed, y = human status. */
export function layoutNodes(): Node[] {
  const raw = ideologies.map((x) => {
    const t = x.rule.axis_targets;
    const px = (t.V1 ?? 0) * 0.7 + (t.V10 ?? 0) * 0.3;
    const py = (t.V3 ?? 0) * 0.5 + (t.V4 ?? 0) * 0.3 + (t.V7 ?? 0) * 0.2;
    return { x, cx: W / 2 + px * (W / 2 - 92), cy: H / 2 - py * (H / 2 - 92) };
  });
  // simple relaxation so nodes don't overlap
  for (let iter = 0; iter < 160; iter++) {
    for (let a = 0; a < raw.length; a++) {
      for (let b = a + 1; b < raw.length; b++) {
        const dx = raw[b].cx - raw[a].cx;
        const dy = raw[b].cy - raw[a].cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = 96;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          raw[a].cx -= ux * push; raw[a].cy -= uy * push;
          raw[b].cx += ux * push; raw[b].cy += uy * push;
        }
      }
    }
    for (const n of raw) {
      n.cx = Math.max(64, Math.min(W - 64, n.cx));
      n.cy = Math.max(64, Math.min(H - 74, n.cy));
    }
  }
  return raw;
}

function edgesHtml(nodes: Node[]): string {
  const seen = new Set<string>();
  let out = '';
  for (const o of nodes) {
    let best: Node | null = null;
    for (const p of nodes) {
      if (p.x.slug === o.x.slug) continue;
      const near = nearestIdeologies(o.x, 1)[0];
      if (near && p.x.slug === near.slug) { best = p; break; }
    }
    if (!best) continue;
    const key = [o.x.slug, best.x.slug].sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    out += `<line class="aedge" x1="${o.cx.toFixed(1)}" y1="${o.cy.toFixed(1)}" x2="${best.cx.toFixed(1)}" y2="${best.cy.toFixed(1)}"></line>`;
  }
  return out;
}

export function renderAtlas(): string {
  const nodes = layoutNodes();
  let grid = '';
  for (let gx = 100; gx < W; gx += 100) grid += `<line class="agrid" x1="${gx}" y1="0" x2="${gx}" y2="${H}"></line>`;
  for (let gy = 80; gy < H; gy += 80) grid += `<line class="agrid" x1="0" y1="${gy}" x2="${W}" y2="${gy}"></line>`;

  const nodeHtml = nodes.map((o) => {
    const light = o.x.copy.fg === '#FFFFFF' ? ' anode--light' : '';
    return `<g class="anode${light}" tabindex="0" role="button" data-slug="${o.x.slug}" aria-label="${esc(o.x.copy.nameZh)}" style="--f:${o.x.copy.fg}" transform="translate(${o.cx.toFixed(1)},${o.cy.toFixed(1)})">` +
      `<rect class="anode__box" x="-24" y="-24" width="48" height="48" fill="${o.x.copy.color}"></rect>` +
      // motif geometry is authored on a 120x120 grid; scale it into the 48x48 box
      `<g class="anode__motif" transform="translate(-21.6 -21.6) scale(0.36)" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${motifInner(o.x.copy.motif)}</g>` +
      `<text class="anode__name" x="0" y="40" text-anchor="middle">${esc(o.x.copy.nameShort)}</text>` +
    `</g>`;
  }).join('');

  return `<section class="atlas">
    <header class="atlas__head">
      <p class="mono tag-line">IDEOLOGY ATLAS</p>
      <h1 id="view-title" tabindex="-1">意识形态谱系</h1>
      <p class="atlas__sub">26 个立场分布在一张参数空间里。横轴是技术节奏（暂停验证 ↔ 加速推进），纵轴是人的位置与智能形态（人类中心 ↔ 多智能共生）。</p>
    </header>
    <div class="atlas__layout">
      <div class="atlas__wrap" id="atlas-wrap">
        <svg id="atlas-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="26 个意识形态节点">
          <rect class="atlas__bg" x="0" y="0" width="${W}" height="${H}"></rect>
          <g class="atlas__grid">${grid}</g>
          <g class="atlas__edges">${edgesHtml(nodes)}</g>
          <g class="atlas__nodes">${nodeHtml}</g>
          <text class="atlas__axlabel" x="${W - 18}" y="${H / 2}" text-anchor="end">加速推进 →</text>
          <text class="atlas__axlabel" x="18" y="${H / 2}">← 暂停验证</text>
          <text class="atlas__axlabel" x="${W / 2}" y="26" text-anchor="middle">↑ 多智能共生 / 数字生命</text>
          <text class="atlas__axlabel" x="${W / 2}" y="${H - 14}" text-anchor="middle">↓ 人类中心 / 碳基唯一</text>
        </svg>
        <div class="atlas__tip" id="atlas-tip" hidden></div>
      </div>
      <aside class="atlas__panel" id="atlas-panel">${atlasIntroHtml()}</aside>
    </div>
  </section>`;
}

export function atlasIntroHtml(): string {
  return `<p class="mono atlas__panelcode">SELECT A NODE</p>
    <p class="atlas__panelsum">点击任意节点，查看它的身份、关键词与相邻立场。连线指向与它最接近的主义。</p>
    <p class="mono atlas__panelnear">26 个节点 · 最近邻连线</p>`;
}

export function atlasPanelHtml(x: Ideology): string {
  const near = nearestIdeologies(x, 2);
  return `<p class="mono atlas__panelcode">已选中的立场</p>
    <div class="atlas__panelmain od-row-top">
      <span class="atlas__swatch od-fixed" style="--c:${x.copy.color};--f:${x.copy.fg}" aria-hidden="true">${motifSvg(x.copy.motif)}</span>
      <div class="od-fill">
        <p class="atlas__panelzh">${esc(x.copy.nameZh)}</p>
        <p class="mono atlas__panelen">${esc(x.copy.nameEn)}</p>
      </div>
    </div>
    <p class="atlas__panelsum">${esc(x.copy.summary)}</p>
    <div class="od-cluster">${x.copy.keywords.map((k) => `<span class="kw">${esc(k)}</span>`).join('')}</div>
    <p class="mono atlas__panelnear">最接近 · ${near.map((y) => esc(y.copy.nameZh)).join(' · ')}</p>
    <div class="od-cluster atlas__panelcta">
      <a class="btn" href="#/ideology/${x.slug}">查看主义详情</a>
      <button type="button" class="btn btn--quiet" data-act="clear-node">清除选择</button>
    </div>`;
}

export function atlasTipHtml(x: Ideology): string {
  return `<span class="mono atlas__tipcode">${esc(x.copy.family)}</span>
    <span class="atlas__tipzh">${esc(x.copy.nameZh)}</span>
    <span class="atlas__tipkw">${x.copy.keywords.map((k) => `<span class="kw">${esc(k)}</span>`).join('')}</span>`;
}
