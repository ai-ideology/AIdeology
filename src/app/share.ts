/**
 * Share payload codec. The report is reproducible from a compact, URL-safe
 * base64 blob so /share works without the visitor's localStorage.
 */
import type { Confidence, HiddenBadge, ProtoScore, ResultPackage, ResultType } from '../scoring/engine';

export interface SharePayload {
  v: 1;
  type: ResultType;
  primary: string | null;
  resonance: string[];
  dual: string[];
  hidden: string[];
  axes: Record<string, number>;
  confidence: Confidence;
  meta: ResultPackage['meta'];
  normalism: boolean;
}

export function encodeShare(result: ResultPackage): string {
  const payload: SharePayload = {
    v: 1,
    type: result.type,
    primary: result.primary?.slug ?? null,
    resonance: result.resonance.map((s) => s.slug),
    dual: result.dual.map((s) => s.slug),
    hidden: result.hidden.map((h) => h.id),
    axes: Object.fromEntries(
      Object.entries(result.axes).map(([k, v]) => [k, Math.round((v ?? 0) * 100) / 100]),
    ),
    confidence: result.confidence,
    meta: result.meta,
    normalism: result.normalism.passed,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(blob: string): SharePayload | null {
  try {
    const pad = blob.length % 4 ? '='.repeat(4 - (blob.length % 4)) : '';
    const bin = atob(blob.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
    if (payload.v !== 1 || !payload.type || !payload.axes) return null;
    return payload;
  } catch {
    return null;
  }
}

export function shareUrl(result: ResultPackage): string {
  const blob = encodeShare(result);
  const base = window.location.origin + window.location.pathname;
  return `${base}#/share?d=${blob}`;
}

export function shareText(
  result: ResultPackage, nameZh: string, manifesto: string, match: number,
): string {
  return [
    'AIdeology · 我的 AI 意识形态',
    nameZh,
    `MATCH ${match.toFixed(1)}`,
    `「${manifesto}」`,
    '',
    shareUrl(result),
  ].join('\n');
}

export type { ProtoScore, HiddenBadge };
