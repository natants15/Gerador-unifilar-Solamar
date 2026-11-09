// Diagrama unifilar da microgeração (prancha A3), baseado no Anexo B.1 do GED 15303 e nos
// modelos do "Material de Apoio" CPFL (itens 1.3.1 medição direta e 1.3.3 medição indireta).
import { Desenho } from './desenho.js';
import { getConcessionaria } from './concessionarias.js';
import { calcular, mesclar, projetoVazio, n, formatar, nPolos, enderecoCompleto } from './projeto.js';

const EMPRESA = {
  nome: 'SOLARMAR COMÉRCIO E IMPORTAÇÃO PRODUTOS LTDA',
  endereco: 'Rua Vitorino Malaquias Ribeiro, 203 - Paraguai II - Itariri/SP',
  cnpj: 'CNPJ 33.948.628/0001-72',
};

// ---------- símbolos ----------

function tracejada(d, x1, y1, x2, y2, layer, passo = 3, vazio = 1.5) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / L; const uy = (y2 - y1) / L;
  for (let s = 0; s < L; s += passo + vazio) {
    const e = Math.min(s + passo, L);
    d.linha(x1 + ux * s, y1 + uy * s, x1 + ux * e, y1 + uy * e, layer);
  }
}
function retTracejado(d, x, y, w, h, layer) {
  tracejada(d, x, y, x + w, y, layer); tracejada(d, x + w, y, x + w, y + h, layer);
  tracejada(d, x + w, y + h, x, y + h, layer); tracejada(d, x, y + h, x, y, layer);
}

/** Marcas de condutores (traços inclinados) sobre uma linha horizontal. */
function marcasCondutores(d, x, y, fases, neutro = true, terra = false, layer = 'EXISTENTE') {
  let i = 0;
  for (let k = 0; k < fases; k++, i++) d.linha(x + i * 1.6 - 1, y - 1.8, x + i * 1.6 + 1, y + 1.8, layer);
  if (neutro) { const xi = x + i * 1.6; d.linha(xi - 1, y - 1.8, xi + 1, y + 1.8, layer); d.linha(xi + 1, y + 1.8, xi + 2, y + 1.8, layer); i++; }
  if (terra) { const xi = x + i * 1.6; d.linha(xi - 1, y - 1.8, xi + 1, y + 1.8, layer); d.linha(xi + 0.2, y + 0.2, xi + 1.4, y - 1, layer); }
}

/** Disjuntor horizontal entre x e x+12 (contato com X e lâmina). */
function disjuntor(d, x, y, layer) {
  d.linha(x, y, x + 3, y, layer);
  d.linha(x + 3, y, x + 9.5, y + 3.5, layer); // lâmina
  d.linha(x + 9, y, x + 12, y, layer);
  d.linha(x + 8, y - 1, x + 10, y + 1, layer); d.linha(x + 8, y + 1, x + 10, y - 1, layer); // X
  d.ret(x + 4.5, y + 3.2, 2.5, 1.6, layer); // atuador térmico
}

/** Chave seccionadora horizontal entre x e x+12. */
function seccionadora(d, x, y, layer) {
  d.linha(x, y, x + 3, y, layer);
  d.circulo(x + 3, y, 0.6, layer);
  d.linha(x + 3, y, x + 9.5, y + 4, layer);
  d.linha(x + 9, y, x + 12, y, layer);
  d.linha(x + 9, y - 1.2, x + 9, y + 1.2, layer);
}

/** Aterramento: ponto (x,y) no topo. */
function terra(d, x, y, layer = 'ATERRAMENTO') {
  d.linha(x, y, x, y - 3, layer);
  d.linha(x - 3, y - 3, x + 3, y - 3, layer);
  d.linha(x - 2, y - 4, x + 2, y - 4, layer);
  d.linha(x - 1, y - 5, x + 1, y - 5, layer);
}

/** DPS em derivação: do ponto (x,y) desce até o terra. */
function dps(d, x, y, layer, rotulo) {
  d.circulo(x, y, 0.7, layer);
  d.linha(x, y, x, y - 6, layer);
  d.ret(x - 2.5, y - 14, 5, 8, layer);
  d.linha(x, y - 7.5, x, y - 12.5, layer); // seta
  d.linha(x - 1, y - 11, x, y - 12.5, layer); d.linha(x + 1, y - 11, x, y - 12.5, layer);
  d.linha(x, y - 14, x, y - 17, layer);
  terra(d, x, y - 17);
  if (rotulo) d.texto(x + 4, y - 10, 2, rotulo, 'TEXTO');
}

/** Medidor kWh: círculo centrado em (x,y), r=7. */
function medidor(d, x, y, layer) {
  d.circulo(x, y, 7, layer);
  d.texto(x, y + 0.5, 2.5, 'kWh', 'TEXTO', 'c', 'm');
  d.linha(x - 3.5, y - 3, x + 3.5, y - 3, layer); // seta bidirecional
  d.linha(x - 3.5, y - 3, x - 2.3, y - 2.2, layer); d.linha(x - 3.5, y - 3, x - 2.3, y - 3.8, layer);
  d.linha(x + 3.5, y - 3, x + 2.3, y - 2.2, layer); d.linha(x + 3.5, y - 3, x + 2.3, y - 3.8, layer);
}

/** TC: dois semicírculos sobre a linha, centrado em x. */
function tc(d, x, y, layer) {
  d.arco(x - 1.5, y, 1.5, 0, 180, layer);
  d.arco(x + 1.5, y, 1.5, 0, 180, layer);
}

/** Inversor: caixa w x h com diagonal, '=' no lado CC (direita) e '~' no lado CA (esquerda). */
function inversor(d, x, y, w, h, layer) {
  d.ret(x, y - h / 2, w, h, layer);
  d.linha(x, y - h / 2, x + w, y + h / 2, layer);
  d.texto(x + w * 0.27, y + h * 0.15, 3.5, '~', 'TEXTO', 'c', 'm');
  d.linha(x + w * 0.62, y - h * 0.18, x + w * 0.84, y - h * 0.18, layer);
  d.linha(x + w * 0.62, y - h * 0.28, x + w * 0.84, y - h * 0.28, layer);
}

/** Arranjo fotovoltaico: retângulos de módulo com célula diagonal. */
function arranjo(d, x, y, layer) {
  for (let i = 0; i < 3; i++) {
    const xi = x + i * 9;
    d.ret(xi, y - 6, 8, 12, layer);
    d.linha(xi, y - 6, xi + 4, y + 6, layer);
    d.linha(xi + 4, y - 6, xi + 8, y + 6, layer);
  }
}

function quebrar(texto, max) {
  const out = [];
  for (const par of String(texto).split('\n')) {
    let linha = '';
    for (const w of par.split(/\s+/)) {
      if ((linha + ' ' + w).trim().length > max) { if (linha) out.push(linha); linha = w; } else linha = (linha + ' ' + w).trim();
    }
    if (linha) out.push(linha);
  }
  return out;
}

// ---------- prancha ----------

export function desenharUnifilar(dadosEntrada) {
  const dados = mesclar(projetoVazio(), dadosEntrada);
  const c = calcular(dados);
  const conc = getConcessionaria(dados.concessionaria);
  const e = dados.entrada;
  const g = dados.geracao;
  const d = new Desenho(420, 297);

  // Moldura A3 e margem
  d.ret(0, 0, 420, 297, 'MOLDURA');
  d.ret(10, 10, 400, 277, 'MOLDURA');

  d.texto(210, 278, 4, 'DIAGRAMA UNIFILAR - MICROGERAÇÃO DISTRIBUÍDA FOTOVOLTAICA', 'TEXTO', 'c');
  d.texto(210, 271, 2.5, `Conexão à rede secundária (BT) - ${conc ? conc.nome : 'CONCESSIONÁRIA'} - medição ${c.medicao === 'indireta' ? 'INDIRETA' : 'DIRETA'}`, 'TEXTO', 'c');

  const fases = nPolos(e.fases) || 3;
  const Y = 215; // linha principal (entrada)

  // Rede da distribuidora
  d.linha(22, 195, 22, 240, 'CONCESSIONARIA');
  d.linha(21, 195, 21, 240, 'CONCESSIONARIA');
  d.texto(14, 250, 2.5, 'REDE DE DISTRIBUIÇÃO BT', 'CONCESSIONARIA');
  d.texto(14, 245, 2.5, `${(dados.distribuidora || (conc ? conc.nome : '')).toUpperCase()} - ${e.tensao || '___/___'} V`, 'CONCESSIONARIA');
  d.circulo(22, Y, 1.2, 'CONCESSIONARIA');
  d.texto(14, 188, 2, 'PONTO DE CONEXÃO', 'CONCESSIONARIA');
  d.linha(22, 191, 22, 213.5, 'COTAS');

  // Ramal de entrada
  d.linha(23.2, Y, 62, Y, 'EXISTENTE');
  marcasCondutores(d, 36, Y, fases, true, false, 'EXISTENTE');
  const bit = `${fases}#${e.bitolaFaseMm2 || '__'}(${e.bitolaNeutroMm2 || e.bitolaFaseMm2 || '__'}) mm² Cu`;
  d.texto(26, Y + 8.5, 2, 'RAMAL DE ENTRADA', 'TEXTO');
  d.texto(26, Y + 4.5, 2, e.ramal === 'subterraneo' ? 'SUBTERRÂNEO' : 'AÉREO', 'TEXTO');
  d.texto(26, Y - 6, 2.2, bit, 'TEXTO');

  // Padrão de entrada (tracejado)
  const px0 = 58; const px1 = 182;
  retTracejado(d, px0, 180, px1 - px0, 60, 'EXISTENTE');
  d.texto(px0 + 2, 236, 2.5, 'PADRÃO DE ENTRADA (EXISTENTE)', 'TEXTO');
  const caixa = [e.categoria ? `CATEGORIA ${e.categoria}` : '', e.tipoCaixa ? `CAIXA ${e.tipoCaixa}`.toUpperCase() : ''].filter(Boolean).join(' - ');
  if (caixa) d.texto(px0 + 2, 231.5, 2.2, caixa, 'TEXTO');

  let x = 62;
  if (c.medicao === 'indireta') {
    d.linha(x, Y, x + 4, Y, 'EXISTENTE');
    seccionadora(d, x + 4, Y, 'EXISTENTE');
    d.texto(x + 10, Y - 7, 2, 'CHAVE SECC.\n200 A S/ PROT.', 'TEXTO', 'c');
    x += 16;
    d.linha(x, Y, x + 6, Y, 'EXISTENTE');
    tc(d, x + 6, Y, 'EXISTENTE');
    d.linha(x + 7.5, Y, x + 12, Y, 'EXISTENTE');
    d.texto(x + 6, Y - 7, 2, `${fases} TCs`, 'TEXTO', 'c');
    d.linha(x + 6, Y + 3, x + 6, Y + 9, 'COTAS');
    d.linha(x + 6, Y + 9, x + 30, Y + 9, 'COTAS');
    d.linha(x + 30, Y + 9, x + 30, Y + 7, 'COTAS');
    x += 12;
  }
  // Medidor
  const xm = x + 14;
  d.linha(x, Y, xm - 7, Y, 'EXISTENTE');
  medidor(d, xm, Y, 'EXISTENTE');
  d.texto(xm, Y - 11, 2.2, 'MEDIDOR', 'TEXTO', 'c');
  d.texto(xm, Y - 14.5, 2.2, 'BIDIRECIONAL', 'TEXTO', 'c');
  d.texto(xm, Y - 18, 1.6, '(pela distribuidora)', 'TEXTO', 'c');
  if (e.numeroMedidor) d.texto(xm, Y - 21.5, 1.8, `Nº atual: ${e.numeroMedidor}`, 'TEXTO', 'c');

  // Disjuntor geral
  const xd = xm + 20;
  d.linha(xm + 7, Y, xd, Y, 'EXISTENTE');
  disjuntor(d, xd, Y, 'EXISTENTE');
  d.texto(xd + 6, Y + 8, 2.2, 'DISJUNTOR GERAL', 'TEXTO', 'c');
  d.texto(xd + 6, Y - 6, 2.2, `${(c.polosGeral || '').toUpperCase()} ${e.disjuntorGeralA || '__'} A`, 'TEXTO', 'c');

  // DPS do padrão
  const xdps = xd + 20;
  d.linha(xd + 12, Y, px1, Y, 'EXISTENTE');
  if (e.dpsEntrada !== false) dps(d, xdps, Y, 'EXISTENTE', 'DPS');

  // Aterramento do padrão
  d.linha(px1 - 8, 186, px1 - 8, 190, 'ATERRAMENTO');
  terra(d, px1 - 8, 186);
  d.texto(px1 - 12, 186.5, 1.7, e.aterramento ? `ATERRAMENTO: ${e.aterramento}`.slice(0, 40) : 'ATERRAMENTO DO PADRÃO', 'TEXTO', 'd');

  // Ramal até o QDG
  const xq = 205;
  d.linha(px1, Y, xq, Y, 'EXISTENTE');
  marcasCondutores(d, 188, Y, fases, true, true, 'EXISTENTE');

  // QDG (barramento)
  d.linha(xq, 150, xq, 232, 'EXISTENTE');
  d.linha(xq + 1, 150, xq + 1, 232, 'EXISTENTE');
  d.texto(xq - 2, 238, 2.5, 'QDG', 'TEXTO');
  d.texto(xq - 2, 234.5, 1.8, 'QUADRO DE DISTRIBUIÇÃO', 'TEXTO');

  // Demais cargas
  d.linha(xq + 1, 225, xq + 14, 225, 'EXISTENTE');
  disjuntor(d, xq + 14, 225, 'EXISTENTE');
  d.linha(xq + 26, 225, xq + 40, 225, 'EXISTENTE');
  d.linha(xq + 40, 225, xq + 37, 227, 'EXISTENTE'); d.linha(xq + 40, 225, xq + 37, 223, 'EXISTENTE');
  d.texto(xq + 43, 224, 2.5, 'DEMAIS CARGAS (EXISTENTES)', 'TEXTO');
  if (n(e.cargaInstaladaKw)) d.texto(xq + 43, 219.5, 2, `Carga instalada: ${formatar(n(e.cargaInstaladaKw))} kW`, 'TEXTO');

  // ----- Sistema de geração (projetado) -----
  const YG = 160;
  d.linha(xq + 1, YG, xq + 10, YG, 'PROJETADO');
  disjuntor(d, xq + 10, YG, 'PROJETADO');
  d.texto(xq + 4, YG + 10, 2, 'DISJUNTOR DO', 'PROJETADO');
  d.texto(xq + 4, YG + 6.5, 2, 'SISTEMA GERADOR', 'PROJETADO');
  d.texto(xq + 16, YG - 6, 2.2, `${(c.polosInversor || '').split(' ')[0].toUpperCase()} ${g.disjuntorInversorA || '__'} A`, 'PROJETADO', 'c');

  const xdg = xq + 34;
  d.linha(xq + 22, YG, xq + 58, YG, 'PROJETADO');
  dps(d, xdg, YG, 'PROJETADO', 'DPS CA\nCL. II');
  const condCA = { FN: 2, FF: 2, FFFN: 4 }[c.conexaoInversor] || fases + 1;
  marcasCondutores(d, xq + 44, YG, condCA - (c.conexaoInversor === 'FF' ? 0 : 1), c.conexaoInversor !== 'FF', true, 'PROJETADO');
  d.texto(xq + 37, YG + 4.5, 1.7, `${condCA}#${g.caboCAMm2 || '__'} + T${g.caboCAMm2 || '__'} mm²`, 'PROJETADO');

  // Inversor
  const xi = xq + 58; const wi = 26; const hi = 20;
  inversor(d, xi, YG, wi, hi, 'PROJETADO');
  const qInv = n(g.inversorQuantidade) || 1;
  const txtInv = [
    `INVERSOR ${qInv > 1 ? `(${qInv}x) ` : ''}${g.inversorMarca || ''}`.trim(),
    `${g.inversorModelo || 'MODELO ___'}`,
    `${qInv} x ${g.inversorPotenciaKw || '__'} kW = ${formatar(c.potenciaInversoresKw) || '__'} kW CA`,
    `Saída ${c.conexaoInversor || '___'} - ${e.tensao || '___'} V`,
    g.inversorInmetro ? `INMETRO: ${g.inversorInmetro}` : 'INMETRO: ________',
    'Proteções 27/59/81/anti-ilhamento',
    'integradas (NBR 16149/16150/62116)',
  ];
  txtInv.forEach((t, i) => d.texto(xi - 2, YG - 16 - i * 3.6, 2, t, 'PROJETADO'));

  // Lado CC
  let xc = xi + wi;
  const strings = Number.isFinite(c.strings) ? c.strings : 1;
  if (g.stringBox) {
    d.linha(xc, YG, xc + 14, YG, 'CC');
    marcasCondutores(d, xc + 4, YG, 2, false, false, 'CC');
    d.ret(xc + 14, YG - 8, 26, 16, 'CC');
    d.texto(xc + 27, YG + 2.5, 2, 'STRING BOX', 'CC', 'c');
    d.texto(xc + 27, YG - 1.5, 1.4, 'CHAVE CC + DPS CC', 'CC', 'c');
    d.texto(xc + 27, YG - 5, 1.4, 'FUSÍVEIS', 'CC', 'c');
    xc += 40;
  }
  const xa = xc + 22;
  d.linha(xc, YG, xa, YG, 'CC');
  marcasCondutores(d, xc + 6, YG, 2, false, false, 'CC');
  d.texto(xc + 2, YG + 4.5, 1.9, `${strings * 2}#${g.caboCCMm2 || 6} mm² CC`, 'CC');
  arranjo(d, xa, YG, 'CC');
  // aterramento da estrutura
  d.linha(xa + 13, YG - 6, xa + 13, YG - 10, 'ATERRAMENTO');
  terra(d, xa + 13, YG - 10);
  const txtMod = [
    `GERADOR FOTOVOLTAICO`,
    `${g.moduloQuantidade || '__'} x ${g.moduloMarca || ''} ${g.moduloModelo || ''}`.replace(/\s+/g, ' '),
    `${g.moduloPotenciaW || '__'} Wp - total ${formatar(c.potenciaPicoKwp) || '__'} kWp`,
    `${strings} string(s)`,
    g.moduloInmetro ? `INMETRO: ${g.moduloInmetro}` : '',
  ].filter(Boolean);
  txtMod.forEach((t, i) => d.texto(xa - 4, YG + 22 - i * 3.6, 2, t, 'CC'));

  // ----- Quadro resumo -----
  const rx = 14; const ry = 135;
  d.ret(rx, ry - 56, 120, 60, 'CARIMBO');
  d.texto(rx + 2, ry, 2.5, 'QUADRO RESUMO', 'TEXTO');
  const resumo = [
    ['Concessionária', dados.distribuidora || (conc ? conc.nome : '')],
    ['Tensão / ligação', `${e.tensao || ''} V - ${({ mono: 'monofásica', bi: 'bifásica', tri: 'trifásica' })[e.fases] || ''}`],
    ['Categoria / disjuntor geral', `${e.categoria || '-'} / ${e.disjuntorGeralA || '-'} A`],
    ['Ramal de entrada', bit],
    ['Medição', c.medicao === 'indireta' ? 'Indireta (TCs)' : 'Direta'],
    ['Carga instalada', n(e.cargaInstaladaKw) ? `${formatar(n(e.cargaInstaladaKw))} kW` : '-'],
    ['Potência dos módulos (CC)', `${formatar(c.potenciaPicoKwp) || '-'} kWp`],
    ['Potência dos inversores (CA)', `${formatar(c.potenciaInversoresKw) || '-'} kW`],
    ['Potência da microgeração', `${formatar(c.potenciaMicrogeracaoKw) || '-'} kW`],
    ['Disjuntor do sistema gerador', `${g.disjuntorInversorA || '-'} A`],
  ];
  resumo.forEach(([k, v], i) => {
    const yy = ry - 6 - i * 4.8;
    d.linha(rx, yy + 3.4, rx + 120, yy + 3.4, 'CARIMBO');
    d.texto(rx + 2, yy, 2, k, 'TEXTO');
    d.texto(rx + 58, yy, 2, String(v).slice(0, 45), 'TEXTO');
  });
  d.linha(rx + 56, ry - 56, rx + 56, ry - 2.6, 'CARIMBO');

  // ----- Legenda -----
  const lx = 140; const ly = 135;
  d.texto(lx, ly, 2.5, 'LEGENDA', 'TEXTO');
  const leg = [['EXISTENTE', 'Instalação existente'], ['PROJETADO', 'Sistema gerador (CA) - projetado'], ['CC', 'Circuito de corrente contínua - projetado'], ['ATERRAMENTO', 'Aterramento'], ['CONCESSIONARIA', 'Rede da distribuidora']];
  leg.forEach(([layer, t], i) => { const yy = ly - 6 - i * 4.5; d.linha(lx, yy + 0.8, lx + 10, yy + 0.8, layer); d.texto(lx + 13, yy, 2, t, 'TEXTO'); });
  d.texto(lx, ly - 31, 2, '#: nº de condutores x seção (neutro entre parênteses)', 'TEXTO');

  // ----- Notas -----
  const nx = 14; const ny = 72;
  d.texto(nx, ny, 2.5, 'NOTAS', 'TEXTO');
  const notas = [
    'Desenho sem escala.',
    'O medidor bidirecional será fornecido e instalado pela distribuidora.',
    ...(conc ? conc.observacoes : []),
    dados.observacoes || '',
  ].filter(Boolean);
  let yy = ny - 5;
  notas.forEach((nt, i) => {
    quebrar(`${i + 1}. ${nt}`, 105).forEach((l) => { if (yy > 14) { d.texto(nx, yy, 1.9, l, 'TEXTO'); yy -= 3.2; } });
  });

  // ----- Carimbo -----
  const cx = 230; const cy = 10; const cw = 180; const ch = 62;
  d.ret(cx, cy, cw, ch, 'CARIMBO');
  d.linha(cx, cy + 50, cx + cw, cy + 50, 'CARIMBO');
  d.texto(cx + 3, cy + 56.5, 2.5, EMPRESA.nome, 'TEXTO');
  d.texto(cx + 3, cy + 52.5, 1.8, `${EMPRESA.endereco} - ${EMPRESA.cnpj}`, 'TEXTO');
  const cli = dados.cliente;
  const linhas = [
    ['CLIENTE', cli.nome],
    ['UC / INSTALAÇÃO', cli.uc],
    ['ENDEREÇO', enderecoCompleto(cli)],
    ['CONCESSIONÁRIA', dados.distribuidora || (conc ? conc.nome : '')],
    ['RESP. TÉCNICO', [dados.responsavel.nome, dados.responsavel.registro].filter(Boolean).join(' - ')],
    ['ART / TRT', dados.responsavel.art],
  ];
  linhas.forEach(([k, v], i) => {
    const yl = cy + 45 - i * 6.2;
    d.texto(cx + 3, yl, 1.8, k, 'TEXTO');
    d.texto(cx + 32, yl, 2.2, String(v || '').slice(0, 70), 'TEXTO');
    d.linha(cx, yl - 2.2, cx + cw, yl - 2.2, 'CARIMBO');
  });
  d.linha(cx + 30, cy + 10.4, cx + 30, cy + 50, 'CARIMBO');
  const hoje = new Date().toLocaleDateString('pt-BR');
  d.texto(cx + 3, cy + 4, 2, `DATA: ${hoje}`, 'TEXTO');
  d.texto(cx + 50, cy + 4, 2, 'ESCALA: S/E', 'TEXTO');
  d.texto(cx + 85, cy + 4, 2, 'FOLHA: 01/01', 'TEXTO');
  d.texto(cx + 120, cy + 4, 2, 'DIAGRAMA UNIFILAR', 'TEXTO');

  return d;
}
