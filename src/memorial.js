// Memorial descritivo do sistema de microgeração (Word .docx).
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, Header, Footer, PageNumber,
} from 'docx';
import { getConcessionaria } from './concessionarias.js';
import { calcular, mesclar, projetoVazio, n, formatar, enderecoCompleto } from './projeto.js';

const FASES = { mono: 'monofásica', bi: 'bifásica', tri: 'trifásica' };

const p = (texto, opts = {}) => new Paragraph({ spacing: { after: 120 }, alignment: opts.align || AlignmentType.JUSTIFIED, children: [new TextRun({ text: texto, bold: opts.bold, size: opts.size || 22 })] });
const h = (texto, nivel = HeadingLevel.HEADING_1) => new Paragraph({ heading: nivel, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: texto, bold: true, size: nivel === HeadingLevel.HEADING_1 ? 26 : 23, color: '1F3864' })] });
const item = (texto) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: texto, size: 22 })] });

const borda = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
function tabela(linhas, larguras = [45, 55]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: linhas.map(([k, v], i) => new TableRow({
      children: [k, v].map((txt, j) => new TableCell({
        width: { size: larguras[j], type: WidthType.PERCENTAGE },
        borders: { top: borda, bottom: borda, left: borda, right: borda },
        shading: j === 0 ? { fill: 'EEF2F7' } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: String(txt ?? '-') || '-', size: 20, bold: j === 0 && i >= 0 })] })],
      })),
    })),
  });
}

export async function gerarMemorial(dadosEntrada) {
  const d = mesclar(projetoVazio(), dadosEntrada);
  const c = calcular(d);
  const conc = getConcessionaria(d.concessionaria);
  const e = d.entrada; const g = d.geracao; const cli = d.cliente; const r = d.responsavel;
  const nomeConc = d.distribuidora || conc?.nome || '';
  const qInv = n(g.inversorQuantidade) || 1;
  const endereco = enderecoCompleto(cli);
  const kwp = formatar(c.potenciaPicoKwp);
  const kwca = formatar(c.potenciaInversoresKw);
  const kwmg = formatar(c.potenciaMicrogeracaoKw);

  const filhos = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'MEMORIAL DESCRITIVO', bold: true, size: 32, color: '1F3864' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `Sistema de Microgeração Distribuída Fotovoltaica - ${kwmg || '___'} kW`, size: 24 })] }),

    h('1. Objetivo'),
    p(`Este memorial descreve o sistema de microgeração distribuída fotovoltaica a ser conectado à rede de baixa tensão da ${nomeConc}, na unidade consumidora de ${cli.nome || '___'}, sob o Sistema de Compensação de Energia Elétrica (Lei 14.300/2022 e REN ANEEL nº 1.000/2021), atendendo às normas técnicas da distribuidora.`),

    h('2. Identificação'),
    tabela([
      ['Titular da unidade consumidora', cli.nome],
      ['CPF/CNPJ', cli.cpfCnpj],
      ['Unidade consumidora (UC/instalação)', cli.uc],
      ['Endereço', endereco],
      ['Coordenadas (SIRGAS 2000)', [cli.latitude, cli.longitude].filter(Boolean).join(', ')],
      ['Distribuidora', nomeConc],
      ['Data da vistoria técnica', cli.dataVistoria],
    ]),

    h('3. Normas e referências'),
    ...(conc?.normas || []).map(item),
    item('ABNT NBR 5410 - Instalações elétricas de baixa tensão'),
    item('ABNT NBR 16690 - Instalações elétricas de arranjos fotovoltaicos'),
    item('ABNT NBR 16149, NBR 16150 e NBR IEC 62116 - Interface de conexão e anti-ilhamento de inversores'),
    item('ABNT NBR 5419 - Proteção contra descargas atmosféricas'),
    item('ANEEL - PRODIST Módulo 3 e REN nº 1.000/2021; Lei 14.300/2022'),

    h('4. Instalação existente (padrão de entrada)'),
    tabela([
      ['Tipo de ligação', `${FASES[e.fases] || '-'} (${e.tensao || '-'} V)`],
      ['Categoria de atendimento', e.categoria],
      ['Ramal de entrada', `${e.ramal === 'subterraneo' ? 'Subterrâneo' : 'Aéreo'} - fase ${e.bitolaFaseMm2 || '-'} mm², neutro ${e.bitolaNeutroMm2 || '-'} mm² (cobre)`],
      ['Caixa / padrão', e.tipoCaixa],
      ['Medição', c.medicao === 'indireta' ? 'Indireta (com TCs)' : 'Direta'],
      ['Medidor atual', [e.numeroMedidor, e.tipoMedidor].filter(Boolean).join(' - ')],
      ['Disjuntor geral', `${c.polosGeral || ''} ${e.disjuntorGeralA || '-'} A`.trim()],
      ['Carga instalada', n(e.cargaInstaladaKw) ? `${formatar(n(e.cargaInstaladaKw))} kW` : '-'],
      ['Aterramento', e.aterramento],
      ['Necessita adequação do padrão', e.adequacaoPadrao ? 'Sim' : 'Não'],
    ]),
    p(e.neutroDisponivel === false
      ? 'O padrão de entrada não possui neutro disponível e será adequado, uma vez que o medidor bidirecional exige neutro desde a entrada até o disjuntor geral.'
      : 'O neutro está disponível desde o ramal de entrada, passando pelo medidor, até o disjuntor geral, condição necessária para a instalação do medidor bidirecional.'),

    h('5. Sistema de geração'),
    h('5.1 Módulos fotovoltaicos', HeadingLevel.HEADING_2),
    tabela([
      ['Fabricante / modelo', `${g.moduloMarca} ${g.moduloModelo}`.trim()],
      ['Potência unitária', `${g.moduloPotenciaW || '-'} Wp`],
      ['Quantidade', g.moduloQuantidade],
      ['Potência total do arranjo', `${kwp || '-'} kWp`],
      ['Número de strings', Number.isFinite(c.strings) ? c.strings : '-'],
      ['Registro INMETRO', g.moduloInmetro],
    ]),
    h('5.2 Inversor(es)', HeadingLevel.HEADING_2),
    tabela([
      ['Fabricante / modelo', `${g.inversorMarca} ${g.inversorModelo}`.trim()],
      ['Potência nominal CA', `${g.inversorPotenciaKw || '-'} kW`],
      ['Quantidade', qInv],
      ['Potência total CA', `${kwca || '-'} kW`],
      ['Conexão à rede', `${c.conexaoInversor || '-'} - ${e.tensao || '-'} V`],
      ['Corrente nominal de saída (calculada)', Number.isFinite(c.correnteInversorA) ? `${formatar(c.correnteInversorA, 1)} A` : '-'],
      ['Registro INMETRO / certificado', g.inversorInmetro],
    ]),
    p(`A potência da microgeração, considerada como a menor entre a potência dos módulos (${kwp || '-'} kWp) e a dos inversores (${kwca || '-'} kW), é de ${kwmg || '-'} kW.`),

    h('6. Proteções'),
    item(`Disjuntor termomagnético ${c.polosInversor || ''} de ${g.disjuntorInversorA || '-'} A, curva C, dedicado ao circuito do inversor, instalado no quadro de distribuição.`),
    item('DPS classe II no lado CA (275 V, 20 kA) e no lado CC (string box ou integrado ao inversor), ligados ao sistema de aterramento.'),
    ...(g.stringBox ? [item('String box com chave seccionadora CC, DPS CC e fusíveis por string, para seccionamento e proteção do arranjo.')] : []),
    item('Funções de proteção integradas ao inversor, certificadas pelo INMETRO: subtensão e sobretensão (27/59), subfrequência e sobrefrequência (81 U/O), anti-ilhamento e reconexão temporizada, conforme NBR 16149, NBR 16150 e NBR IEC 62116.'),
    item(`Disjuntor geral existente de ${e.disjuntorGeralA || '-'} A no padrão de entrada, como dispositivo de seccionamento visível e proteção geral da unidade consumidora.`),

    h('7. Condutores'),
    item(`Circuito CC: cabo solar ${g.caboCCMm2 || 6} mm², 1,8 kV CC, resistente a UV, com conectores do tipo MC4.`),
    item(`Circuito CA (inversor - quadro): cabo de cobre flexível ${g.caboCAMm2 || '-'} mm², 750 V, protegido em eletroduto.`),
    item('Condutor de proteção (PE) e equipotencialização das estruturas metálicas dos módulos ao aterramento da instalação.'),

    h('8. Aterramento'),
    p(`O sistema de geração será interligado ao aterramento existente da unidade consumidora${e.aterramento ? ` (${e.aterramento})` : ''}, garantindo a equipotencialização das massas, estruturas e DPS, conforme NBR 5410.`),

    h('9. Estrutura e local de instalação'),
    p(`Os módulos serão instalados sobre ${d.telhado.tipoTelha || 'o telhado'}${d.telhado.estrutura ? `, com estrutura de suporte ${d.telhado.estrutura}` : ''}${d.telhado.estruturaTelhado ? ` (estrutura do telhado: ${d.telhado.estruturaTelhado})` : ''}.`),

    h('10. Sinalização'),
    p('Será instalada placa de advertência junto ao padrão de entrada indicando a existência de geração própria, conforme modelo da norma da distribuidora.'),

    h('11. Medição'),
    p(`A medição de energia será feita por medidor bidirecional fornecido e instalado pela ${nomeConc}, em substituição ao medidor existente${c.medicao === 'indireta' ? ', com medição indireta por meio de transformadores de corrente' : ''}.`),

    ...(conc?.observacoes?.length ? [h('12. Observações da distribuidora'), ...conc.observacoes.map(item)] : []),
    ...(d.observacoes ? [h('13. Observações do projeto'), p(d.observacoes)] : []),

    h('Responsável técnico'),
    tabela([
      ['Nome', r.nome],
      ['Título', r.titulo],
      ['Registro CREA/CFT', r.registro],
      ['ART/TRT', r.art],
    ]),
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '_______________________________________', size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.nome || 'Responsável técnico', size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: [r.titulo, r.registro].filter(Boolean).join(' - '), size: 20 })] }),
  ];

  const doc = new Document({
    creator: 'Solarmar',
    title: `Memorial descritivo - ${cli.nome}`,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{
      properties: { page: { margin: { top: 1300, bottom: 1100, left: 1300, right: 1100 } } },
      headers: { default: new Header({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SOLARMAR COMÉRCIO E IMPORTAÇÃO PRODUTOS LTDA', bold: true, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Rua Vitorino Malaquias Ribeiro, 203 – Paraguai II – Itariri/SP · CNPJ 33.948.628/0001-72', size: 16 })] }),
      ] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16 })] })] }) },
      children: filhos,
    }],
  });
  return Packer.toBuffer(doc);
}
