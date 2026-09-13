import { hiddenCopyById, ideologies } from '../content';
import { esc, pad2 } from '../ui/dom';
import { axisRowHtml } from '../ui/components';
import { CORE_AXES, EXTENDED_AXES } from '../content/types';
import { RESULT_TYPE_LABEL, type Confidence, type ResultPackage } from '../scoring/engine';
import type { SharePayload } from '../app/share';

/** Rebuild a renderable shape from a share payload (no localStorage needed). */
export function payloadToResult(p: SharePayload): ResultPackage {
  const mk = (slug: string) => {
    const x = ideologies.find((i) => i.slug === slug)!;
    return {
      slug, id: x.id, code: x.code, nameZh: x.copy.nameZh,
      axisFit: 0, discEvidence: 0, consistency: 0, penalty: 0, rawFit: 0, finalFit: 0,
      hallmark: { status: 'FAIL' as const, score: 0, hits: [], misses: [], adaptiveAsked: true, adaptiveRequiredHit: false },
    };
  };
  return {
    type: p.type,
    axes: p.axes as ResultPackage['axes'],
    primary: p.primary ? mk(p.primary) : null,
    resonance: p.resonance.map(mk),
    dual: p.dual.map(mk),
    scores: [],
    confidence: p.confidence,
    hidden: p.hidden.map((id) => {
      const c = hiddenCopyById.get(id);
      return { id, nameZh: c?.nameZh ?? id, nameEn: c?.nameEn ?? '', summary: c?.summary ?? '', keywords: c?.keywords ?? [], strength: 0, reasons: [] };
    }),
    normalism: { passed: p.normalism, tagOnly: false },
    meta: p.meta,
    beliefTags: [],
  };
}

function confLine(label: string, c: { value: number; label: string }): string {
  return `<div class="share-conf od-row"><span class="share-conf__l od-fill">${esc(label)}</span><span class="kw">${esc(c.label)}</span></div>`;
}

export function renderShare(payload: SharePayload): string {
  const r = payloadToResult(payload);
  const primary = r.primary ? ideologies.find((x) => x.slug === r.primary!.slug)! : null;
  if (!primary) {
    return `<section class="empty">
      <p class="mono empty__code">SHARED RESULT</p>
      <h1 id="view-title" tabindex="-1">这份结果未定型</h1>
      <p class="empty__p">分享的是一份「低信息量 / 未定型」结果——你的 AI 世界观仍在形成中。</p>
      <div class="od-cluster"><button type="button" class="btn btn--primary btn--lg" data-act="start-test">自己测一次</button>
      <a class="btn btn--lg" href="#/library">打开图鉴</a></div>
    </section>`;
  }
  const c = primary.copy;
  const typeLabel = RESULT_TYPE_LABEL[r.type];
  const axes = [...CORE_AXES, ...EXTENDED_AXES].map((a) => axisRowHtml(a, r.axes[a] ?? 0, c.color)).join('');
  const resonance = r.resonance.length
    ? `<div class="mini-grid">${r.resonance.map((s) => {
        const x = ideologies.find((i) => i.slug === s.slug)!;
        return `<a class="mini" href="#/ideology/${x.slug}" style="--c:${x.copy.color};--f:${x.copy.fg}">
          <span class="mini__top od-row"><span class="mono mini__code od-fill">${x.code}</span></span>
          <span class="mini__zh">${esc(x.copy.nameZh)}</span>
          <span class="mini__en mono">${esc(x.copy.nameEn)}</span></a>`;
      }).join('')}</div>`
    : `<p class="rsec__p">没有其他主义进入共鸣区间。</p>`;

  return `<article class="result share-page" style="--c:${c.color};--f:${c.fg}">
    <header class="result__hero">
      <div class="result__left">
        <p class="mono result__code">SHARED RESULT · ${typeLabel}</p>
        <h1 id="view-title" tabindex="-1" class="result__zh">${esc(c.nameZh)}</h1>
        <p class="mono result__en">${esc(c.nameEn)}</p>
        <p class="result__mfzh">${esc(c.manifestoZh)}</p>
        <p class="result__mf">${esc(c.manifestoEn)}</p>
        <p class="mono result__meta-line">${primary.code} · 来自好友分享 · 置信度 ${esc(r.confidence.identity.label)}</p>
        <div class="result__cta od-cluster">
          <button type="button" class="btn btn--primary btn--lg" data-act="start-test">测测我是哪一种</button>
          <a class="btn btn--lg" href="#/ideology/${primary.slug}">查看这个主义</a>
        </div>
      </div>
      <div class="result__right">
        <div class="result__num" aria-hidden="true">${pad2(primary.id)}</div>
        <figure class="result__figure"><img class="result__char" src="./assets/char/${primary.slug}.webp" alt="${esc(c.nameZh)}主视觉" decoding="async"></figure>
      </div>
    </header>
    <div class="result__body">
      <section class="rsec">
        <h2 class="rsec__h">价值轴定位</h2>
        <p class="mono rsec__sub">AXIS VECTOR · SHARED SNAPSHOT</p>
        <div class="axes">${axes}</div>
      </section>
      <section class="rsec"><h2 class="rsec__h">相近主义</h2>${resonance}</section>
      <section class="rsec">
        <h2 class="rsec__h">置信度</h2>
        <div class="conf-list">
          ${confLine('身份置信', r.confidence.identity)}
          ${confLine('判别置信', r.confidence.discrimination)}
          ${confLine('测量置信', r.confidence.measurement)}
        </div>
      </section>
      <section class="rsec rsec--cta">
        <h2 class="rsec__h">你的未来是哪一种？</h2>
        <p class="rsec__p">这是好友分享的结果快照。回答 48 道核心情景题，找到你自己的 AI 意识形态。</p>
        <div class="od-cluster"><button type="button" class="btn btn--primary btn--lg" data-act="start-test">开始测试</button>
        <a class="btn btn--lg" href="#/library">打开图鉴</a></div>
      </section>
    </div>
  </article>`;
}

export function renderShareError(): string {
  return `<section class="empty">
    <p class="mono empty__code">INVALID LINK</p>
    <h1 id="view-title" tabindex="-1">分享链接无法读取</h1>
    <p class="empty__p">这份分享数据不完整或已损坏。你可以直接自己测一次。</p>
    <div class="od-cluster"><button type="button" class="btn btn--primary btn--lg" data-act="start-test">开始测试</button>
    <a class="btn btn--lg" href="#/">回到首页</a></div>
  </section>`;
}

/* ---------- share card (canvas → PNG download) ---------- */

export interface CardInput {
  nameZh: string; nameEn: string; code: string; manifestoZh: string; manifestoEn: string;
  color: string; fg: string; match: number | null; confidence: Confidence; typeLabel: string;
}

export async function drawShareCard(input: CardInput): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sans = '"Space Grotesk","MiSans","PingFang SC","Microsoft YaHei",sans-serif';
  const mono = '"JetBrains Mono",monospace';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = input.color;
  ctx.fillRect(0, 0, W, H - 220);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, H - 220, W, 220);

  // brand
  ctx.fillStyle = input.fg;
  ctx.font = `700 30px ${mono}`;
  ctx.fillText('AIdeology', 64, 92);

  // code + match
  ctx.font = `700 26px ${mono}`;
  const codeLine = input.match !== null ? `${input.code} · MATCH ${input.match.toFixed(1)}` : input.code;
  ctx.fillText(codeLine, 64, 150);

  // name
  ctx.font = `900 92px ${sans}`;
  wrapText(ctx, input.nameZh, 64, 290, W - 128, 96);

  // english
  ctx.font = `700 30px ${mono}`;
  ctx.fillText(input.nameEn, 64, 400);

  // manifesto
  ctx.font = `800 52px ${sans}`;
  wrapText(ctx, input.manifestoZh, 64, 520, W - 128, 62);

  ctx.font = `800 40px ${sans}`;
  wrapText(ctx, input.manifestoEn, 64, 640, W - 128, 50);

  // type + confidence strip
  ctx.font = `600 26px ${mono}`;
  ctx.fillText(`${input.typeLabel} · IDENTITY ${input.confidence.identity.label} / DISCRIM ${input.confidence.discrimination.label}`, 64, 760);

  // footer
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 34px ${sans}`;
  ctx.fillText('不同思想，争夺不同的未来。', 64, H - 120);
  ctx.fillStyle = input.color;
  ctx.font = `500 24px ${mono}`;
  ctx.fillText('AIDEOLOGY — 26 POSSIBLE FUTURES', 64, H - 70);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
  const chars = [...text];
  let line = '';
  let cy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = ch;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}
