/** Tiny DOM helpers — the app renders template strings and delegates events. */

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export function pad2(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

/** Join class names, dropping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function svg(inner: string, extra = ''): string {
  return `<svg class="motif" viewBox="0 0 120 120" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square" stroke-linejoin="miter" ${extra}>${inner}</svg>`;
}

const MOTIFS: Record<string, string> = {
  arrow: '<path d="M60 104V30M60 30 32 58M60 30l28 28" stroke-width="10"/><path d="M14 104h22M84 104h22"/>',
  stair: '<path d="M14 100h24V76h24V52h24V28h20" stroke-width="9"/>',
  orbit: '<circle cx="60" cy="60" r="42"/><circle cx="60" cy="60" r="20"/><circle cx="60" cy="18" r="8" fill="currentColor" stroke="none"/>',
  stop: '<rect x="16" y="30" width="88" height="16" fill="currentColor" stroke="none"/><rect x="16" y="74" width="88" height="16" fill="currentColor" stroke="none"/>',
  target: '<circle cx="60" cy="60" r="40"/><circle cx="60" cy="60" r="16"/><path d="M60 8v20M60 92v20M8 60h20M92 60h20"/>',
  guardrail: '<path d="M14 96 106 24"/><path d="M30 96V78M54 74V56M78 52V34M102 30V12"/>',
  rest: '<path d="M14 44h92M14 60h92M14 76h92"/><circle cx="60" cy="96" r="10" fill="currentColor" stroke="none"/>',
  steady: '<circle cx="60" cy="52" r="34"/><path d="M12 96h96"/>',
  growth: '<path d="M18 100V70h20v30M50 100V50h20v50M82 100V26h20v74"/>',
  genesis: '<circle cx="46" cy="54" r="28"/><circle cx="76" cy="70" r="28"/>',
  upload: '<path d="M60 88V24M60 24 36 48M60 24l24 24"/><path d="M20 92v14h80V92"/>',
  helix: '<path d="M36 12c40 24-40 72 0 96M84 12c-40 24 40 72 0 96"/><path d="M44 34h32M40 60h40M44 86h32" stroke-width="7"/>',
  squarecircle: '<rect x="18" y="18" width="56" height="56" stroke-width="9"/><circle cx="78" cy="78" r="28"/>',
  nodes: '<circle cx="60" cy="60" r="12" fill="currentColor" stroke="none"/><circle cx="60" cy="18" r="8"/><circle cx="98" cy="44" r="8"/><circle cx="84" cy="98" r="8"/><circle cx="26" cy="92" r="8"/><circle cx="18" cy="40" r="8"/><path d="M60 30v18M90 48 70 56M78 92 66 70M34 88 52 66M26 44 50 54" stroke-width="6"/>',
  interlock: '<rect x="16" y="16" width="56" height="56" stroke-width="9"/><rect x="48" y="48" width="56" height="56" stroke-width="9"/>',
  axis: '<path d="M60 12v96" stroke-width="8"/><circle cx="60" cy="60" r="16"/><path d="M60 60 24 34M60 60l36-26" stroke-width="7"/>',
  share: '<circle cx="24" cy="60" r="12"/><circle cx="96" cy="26" r="12"/><circle cx="96" cy="94" r="12"/><path d="M35 54 85 32M35 66l50 22" stroke-width="7"/>',
  network: '<path d="M24 24h72v72H24z" stroke-width="7"/><path d="M24 48h72M24 72h72M48 24v72M72 24v72" stroke-width="4"/>',
  flow: '<path d="M60 12 96 48 60 84 24 48z"/><path d="M60 84v24"/>',
  gauge: '<path d="M16 84a44 44 0 0 1 88 0" stroke-width="9"/><path d="M60 84 84 52" stroke-width="9"/><circle cx="60" cy="84" r="8" fill="currentColor" stroke="none"/>',
  link: '<circle cx="44" cy="60" r="26" stroke-width="9"/><circle cx="76" cy="60" r="26" stroke-width="9"/>',
  fork: '<path d="M60 108V56M60 56 28 24M60 56l32-32" stroke-width="9"/><circle cx="60" cy="110" r="7" fill="currentColor" stroke="none"/>',
  window: '<rect x="18" y="18" width="84" height="84" stroke-width="9"/><path d="M18 18 84 84" stroke-width="9"/>',
  chart: '<path d="M16 96 44 64l20 16 40-52" stroke-width="9"/><path d="M84 28h20v20" stroke-width="9"/>',
  shield: '<path d="M60 12 100 30v34c0 26-18 38-40 46-22-8-40-20-40-46V30z"/><rect x="48" y="46" width="24" height="24" stroke-width="7"/>',
  dual: '<path d="M22 18v84M98 18v84" stroke-width="8"/><path d="M22 60h16M30 52l8 8-8 8M98 60H82M90 52l-8 8 8 8" stroke-width="7"/>',
  key: '<circle cx="42" cy="44" r="22"/><path d="M56 58 96 98M78 80l12 12M64 66l10 10" stroke-width="9"/>',
  globe: '<circle cx="60" cy="60" r="44"/><path d="M16 60h88M60 16c18 16 18 72 0 88M60 16c-18 16-18 72 0 88" stroke-width="7"/>',
};

export function motifSvg(kind: string): string {
  return svg(MOTIFS[kind] ?? '<rect x="24" y="24" width="72" height="72" stroke-width="9"/>');
}
