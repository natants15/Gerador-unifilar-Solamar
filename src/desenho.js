// Modelo de desenho simples (linhas, círculos, arcos, textos) com saída DXF (R12, abre em
// qualquer AutoCAD) e SVG (pré-visualização na tela). Unidade: milímetro.

export const LAYERS = {
  CONCESSIONARIA: 1, // vermelho
  EXISTENTE: 7, // branco/preto
  PROJETADO: 5, // azul
  CC: 30, // laranja
  ATERRAMENTO: 3, // verde
  TEXTO: 7,
  COTAS: 8,
  CARIMBO: 7,
  MOLDURA: 7,
};

const SVG_COR = { 1: '#d0021b', 7: '#111', 5: '#1f5fbf', 30: '#d97706', 3: '#15803d', 8: '#666' };

export class Desenho {
  constructor(largura = 420, altura = 297) {
    this.largura = largura;
    this.altura = altura;
    this.ents = [];
  }
  linha(x1, y1, x2, y2, layer = 'EXISTENTE') { this.ents.push({ t: 'linha', x1, y1, x2, y2, layer }); return this; }
  poli(pts, layer = 'EXISTENTE', fechada = false) {
    for (let i = 0; i < pts.length - 1; i++) this.linha(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], layer);
    if (fechada && pts.length > 2) this.linha(pts.at(-1)[0], pts.at(-1)[1], pts[0][0], pts[0][1], layer);
    return this;
  }
  ret(x, y, w, h, layer = 'EXISTENTE') { return this.poli([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], layer, true); }
  circulo(x, y, r, layer = 'EXISTENTE') { this.ents.push({ t: 'circulo', x, y, r, layer }); return this; }
  /** Arco anti-horário de a0 a a1 (graus). */
  arco(x, y, r, a0, a1, layer = 'EXISTENTE') { this.ents.push({ t: 'arco', x, y, r, a0, a1, layer }); return this; }
  /** alinh: 'e' (esquerda), 'c' (centro), 'd' (direita); valign: 'b' base, 'm' meio */
  texto(x, y, h, str, layer = 'TEXTO', alinh = 'e', valign = 'b') {
    const linhas = String(str ?? '').split('\n');
    linhas.forEach((s, i) => this.ents.push({ t: 'texto', x, y: y - i * h * 1.5, h, s, layer, alinh, valign }));
    return this;
  }

  toDXF() {
    const out = [];
    const p = (code, val) => { out.push(String(code)); out.push(String(val)); };
    p(0, 'SECTION'); p(2, 'HEADER');
    p(9, '$ACADVER'); p(1, 'AC1009');
    p(9, '$DWGCODEPAGE'); p(3, 'ANSI_1252');
    p(9, '$INSUNITS'); p(70, 4);
    p(9, '$EXTMIN'); p(10, 0); p(20, 0);
    p(9, '$EXTMAX'); p(10, this.largura); p(20, this.altura);
    p(9, '$LIMMIN'); p(10, 0); p(20, 0);
    p(9, '$LIMMAX'); p(10, this.largura); p(20, this.altura);
    p(0, 'ENDSEC');

    p(0, 'SECTION'); p(2, 'TABLES');
    p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 1);
    p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, 0);
    p(0, 'ENDTAB');
    const layers = Object.entries(LAYERS);
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, layers.length + 1);
    p(0, 'LAYER'); p(2, '0'); p(70, 0); p(62, 7); p(6, 'CONTINUOUS');
    for (const [nome, cor] of layers) { p(0, 'LAYER'); p(2, nome); p(70, 0); p(62, cor); p(6, 'CONTINUOUS'); }
    p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'STYLE'); p(70, 1);
    p(0, 'STYLE'); p(2, 'STANDARD'); p(70, 0); p(40, 0); p(41, 1); p(50, 0); p(71, 0); p(42, 2.5); p(3, 'txt'); p(4, '');
    p(0, 'ENDTAB');
    p(0, 'ENDSEC');

    p(0, 'SECTION'); p(2, 'ENTITIES');
    const f = (v) => Number(v.toFixed(4));
    for (const e of this.ents) {
      if (e.t === 'linha') {
        p(0, 'LINE'); p(8, e.layer); p(10, f(e.x1)); p(20, f(e.y1)); p(30, 0); p(11, f(e.x2)); p(21, f(e.y2)); p(31, 0);
      } else if (e.t === 'circulo') {
        p(0, 'CIRCLE'); p(8, e.layer); p(10, f(e.x)); p(20, f(e.y)); p(30, 0); p(40, f(e.r));
      } else if (e.t === 'arco') {
        p(0, 'ARC'); p(8, e.layer); p(10, f(e.x)); p(20, f(e.y)); p(30, 0); p(40, f(e.r)); p(50, f(e.a0)); p(51, f(e.a1));
      } else if (e.t === 'texto') {
        if (!e.s) continue;
        const h72 = { e: 0, c: 1, d: 2 }[e.alinh] ?? 0;
        const v73 = e.valign === 'm' ? 2 : 0;
        p(0, 'TEXT'); p(8, e.layer); p(10, f(e.x)); p(20, f(e.y)); p(30, 0); p(40, e.h); p(1, limparTexto(e.s)); p(7, 'STANDARD');
        if (h72 || v73) { p(72, h72); p(73, v73); p(11, f(e.x)); p(21, f(e.y)); p(31, 0); }
      }
    }
    p(0, 'ENDSEC');
    p(0, 'EOF');
    // DXF R12 em ANSI 1252 (latin1 cobre os acentos do português)
    return Buffer.from(out.join('\r\n') + '\r\n', 'latin1');
  }

  toSVG() {
    const H = this.altura;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = [];
    for (const e of this.ents) {
      const cor = SVG_COR[LAYERS[e.layer]] || '#111';
      if (e.t === 'linha') parts.push(`<line x1="${e.x1}" y1="${H - e.y1}" x2="${e.x2}" y2="${H - e.y2}" stroke="${cor}" stroke-width="0.35"/>`);
      else if (e.t === 'circulo') parts.push(`<circle cx="${e.x}" cy="${H - e.y}" r="${e.r}" fill="none" stroke="${cor}" stroke-width="0.35"/>`);
      else if (e.t === 'arco') {
        const rad = (a) => (a * Math.PI) / 180;
        const x0 = e.x + e.r * Math.cos(rad(e.a0)); const y0 = H - (e.y + e.r * Math.sin(rad(e.a0)));
        const x1 = e.x + e.r * Math.cos(rad(e.a1)); const y1 = H - (e.y + e.r * Math.sin(rad(e.a1)));
        let sweep = e.a1 - e.a0; if (sweep < 0) sweep += 360;
        parts.push(`<path d="M ${x0} ${y0} A ${e.r} ${e.r} 0 ${sweep > 180 ? 1 : 0} 0 ${x1} ${y1}" fill="none" stroke="${cor}" stroke-width="0.35"/>`);
      } else if (e.t === 'texto' && e.s) {
        const anchor = { e: 'start', c: 'middle', d: 'end' }[e.alinh] || 'start';
        const dy = e.valign === 'm' ? ' dominant-baseline="middle"' : '';
        parts.push(`<text x="${e.x}" y="${H - e.y}" font-size="${e.h * 1.4}" font-family="Arial, sans-serif" fill="${cor}" text-anchor="${anchor}"${dy}>${esc(e.s)}</text>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.largura} ${H}" width="100%" style="background:#fff">${parts.join('')}</svg>`;
  }
}

function limparTexto(s) {
  // Troca caracteres fora do latin1 por equivalentes
  return String(s)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/²/g, '²')
    .replace(/[^\x20-\xFF]/g, '?');
}
