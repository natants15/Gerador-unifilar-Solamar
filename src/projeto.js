// Modelo de dados do projeto, cálculos derivados, validações e lista de materiais.
import { getConcessionaria, getCategoria, sugerirCategoria } from './concessionarias.js';

export const DISJUNTORES_PADRAO = [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 150, 175, 200];

// Capacidade de condução aproximada, cobre PVC 70 °C, método B1, 2 condutores carregados (NBR 5410, tab. 36).
const AMPACIDADE_CA = [
  [2.5, 24], [4, 32], [6, 41], [10, 57], [16, 76], [25, 101], [35, 125], [50, 151], [70, 192], [95, 232],
];

export function projetoVazio() {
  return {
    cliente: { nome: '', cpfCnpj: '', uc: '', endereco: '', cidade: '', uf: 'SP', latitude: '', longitude: '', dataVistoria: '' },
    concessionaria: '',
    distribuidora: '',
    entrada: {
      fases: '', // mono | bi | tri
      tensao: '', // 127/220 | 220/380 | 120/240 | 127/254
      categoria: '',
      disjuntorGeralA: '',
      bitolaFaseMm2: '',
      bitolaNeutroMm2: '',
      ramal: 'aereo', // aereo | subterraneo
      tipoCaixa: '',
      medicao: '', // direta | indireta
      numeroMedidor: '',
      tipoMedidor: '', // analogico | digital
      cargaInstaladaKw: '',
      neutroDisponivel: true,
      adequacaoPadrao: false,
      aterramento: '',
      dpsEntrada: true,
    },
    geracao: {
      moduloMarca: '', moduloModelo: '', moduloPotenciaW: '', moduloQuantidade: '', moduloInmetro: '',
      inversorMarca: '', inversorModelo: '', inversorPotenciaKw: '', inversorQuantidade: 1, inversorInmetro: '',
      inversorConexao: '', // FN | FF | FFFN
      strings: '',
      stringBox: true,
      caboCCMm2: 6,
      caboCAMm2: '',
      disjuntorInversorA: '',
      distanciaArranjoInversorM: 15,
      distanciaInversorQuadroM: 10,
    },
    telhado: {
      tipoTelha: '', estrutura: '', estruturaTelhado: '', distanciaVigas: '', quedas: '', geometria: '',
      dimensoes: '', acessibilidade: '', condulete: false, observacoes: '',
    },
    responsavel: { nome: '', titulo: 'Engenheiro Eletricista', registro: '', art: '' },
    observacoes: '',
    materiais: null, // null = gerar automaticamente
  };
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  // "1.234,5" -> 1234.5 ; "5,5" -> 5.5 ; "5.5" -> 5.5
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return parseFloat(norm);
};
export const n = num;

const fmt = (v, casas = 2) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas }) : '');
export const formatar = fmt;

export function mesclar(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) {
      out[k] = mesclar(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function enderecoCompleto(cli = {}) {
  const base = String(cli.endereco || '');
  const extra = [cli.cidade, cli.uf].filter((x) => x && !base.toLowerCase().includes(String(x).toLowerCase()));
  return [base, ...extra].filter(Boolean).join(' - ');
}

export function polos(fases) {
  return { mono: 'monopolar', bi: 'bipolar', tri: 'tripolar' }[fases] || '';
}
export function nPolos(fases) {
  return { mono: 1, bi: 2, tri: 3 }[fases] || 0;
}

export function tensaoFN(tensao) {
  const [fn] = String(tensao || '').split('/').map(Number);
  return fn || 127;
}
export function tensaoFF(tensao) {
  const p = String(tensao || '').split('/').map(Number);
  return p[1] || 220;
}

export function proximoDisjuntor(correnteA) {
  return DISJUNTORES_PADRAO.find((d) => d >= correnteA) || null;
}

export function caboPorCorrente(correnteA) {
  const r = AMPACIDADE_CA.find(([, a]) => a >= correnteA);
  return r ? r[0] : null;
}

/** Calcula os valores derivados (não altera o que o usuário preencheu). */
export function calcular(dados) {
  const d = mesclar(projetoVazio(), dados);
  const g = d.geracao;
  const e = d.entrada;
  const conc = getConcessionaria(d.concessionaria);

  const potenciaModuloW = num(g.moduloPotenciaW);
  const qtdModulos = num(g.moduloQuantidade);
  const potInvKw = num(g.inversorPotenciaKw);
  const qtdInv = num(g.inversorQuantidade) || 1;

  const potenciaPicoKwp = Number.isFinite(potenciaModuloW) && Number.isFinite(qtdModulos) ? (potenciaModuloW * qtdModulos) / 1000 : NaN;
  const potenciaInversoresKw = Number.isFinite(potInvKw) ? potInvKw * qtdInv : NaN;
  const potenciaInstaladaKw = [potenciaPicoKwp, potenciaInversoresKw].filter(Number.isFinite);
  const potenciaMicrogeracaoKw = potenciaInstaladaKw.length ? Math.min(...potenciaInstaladaKw) : NaN;

  // Tipo de conexão do inversor: informado ou inferido pela entrada
  let conexao = g.inversorConexao;
  if (!conexao) {
    if (e.fases === 'tri' && potInvKw > 8) conexao = 'FFFN';
    else if (e.fases === 'mono') conexao = 'FN';
    else if (e.fases) conexao = 'FF';
  }
  const vFN = tensaoFN(e.tensao);
  const vFF = tensaoFF(e.tensao);
  let correnteInversorA = NaN;
  if (Number.isFinite(potInvKw)) {
    const w = potInvKw * 1000;
    if (conexao === 'FFFN') correnteInversorA = w / (Math.sqrt(3) * vFF);
    else if (conexao === 'FN') correnteInversorA = w / vFN;
    else correnteInversorA = w / vFF;
  }
  const disjuntorInversorSugeridoA = Number.isFinite(correnteInversorA) ? proximoDisjuntor(correnteInversorA * 1.25) : null;
  const caboCASugeridoMm2 = disjuntorInversorSugeridoA ? Math.max(4, caboPorCorrente(disjuntorInversorSugeridoA) || 4) : null;

  const categoria = getCategoria(d.concessionaria, e.categoria)
    || sugerirCategoria(d.concessionaria, e.fases, e.tensao, num(e.disjuntorGeralA));
  const medicao = e.medicao || (categoria ? categoria.medicao : (num(e.disjuntorGeralA) > (conc?.medicaoDiretaMaxA ?? 100) ? 'indireta' : 'direta'));

  const strings = num(g.strings) || (Number.isFinite(qtdModulos) ? Math.max(1, Math.ceil(qtdModulos / 12)) : NaN);

  return {
    potenciaPicoKwp,
    potenciaInversoresKw,
    potenciaMicrogeracaoKw,
    conexaoInversor: conexao,
    correnteInversorA,
    disjuntorInversorSugeridoA,
    caboCASugeridoMm2,
    categoria,
    medicao,
    strings,
    polosGeral: polos(e.fases),
    polosInversor: { FN: 'bipolar (F+N)', FF: 'bipolar', FFFN: 'tripolar' }[conexao] || '',
    limiteMicrogeradorKw: categoria && conc?.limiteMicrogeradorKw?.[categoria.codigo]?.[conexao],
  };
}

/**
 * Preenche campos vazios com valores sugeridos (categoria, bitola, disjuntor do inversor, cabo CA...).
 * Retorna os dados completos + a lista de campos que foram sugeridos (para destacar na tela).
 */
export function completar(dados) {
  const d = mesclar(projetoVazio(), dados);
  const c = calcular(d);
  const sugeridos = [];
  const set = (obj, campo, valor, caminho) => {
    if ((obj[campo] === '' || obj[campo] === null || obj[campo] === undefined) && valor !== null && valor !== undefined && valor !== '' && !Number.isNaN(valor)) {
      obj[campo] = valor;
      sugeridos.push(caminho);
    }
  };
  const conc = getConcessionaria(d.concessionaria);
  if (conc) {
    set(d, 'distribuidora', conc.distribuidoras[0], 'distribuidora');
    if (!d.entrada.tensao) set(d.entrada, 'tensao', conc.tensoes[0], 'entrada.tensao');
  }
  if (c.categoria) {
    set(d.entrada, 'categoria', c.categoria.codigo, 'entrada.categoria');
    set(d.entrada, 'disjuntorGeralA', c.categoria.disjuntorA, 'entrada.disjuntorGeralA');
    set(d.entrada, 'bitolaFaseMm2', c.categoria.bitolaMm2, 'entrada.bitolaFaseMm2');
    set(d.entrada, 'bitolaNeutroMm2', c.categoria.bitolaMm2, 'entrada.bitolaNeutroMm2');
  }
  set(d.entrada, 'medicao', c.medicao, 'entrada.medicao');
  set(d.geracao, 'inversorConexao', c.conexaoInversor, 'geracao.inversorConexao');
  set(d.geracao, 'disjuntorInversorA', c.disjuntorInversorSugeridoA, 'geracao.disjuntorInversorA');
  set(d.geracao, 'caboCAMm2', c.caboCASugeridoMm2, 'geracao.caboCAMm2');
  if (Number.isFinite(c.strings)) set(d.geracao, 'strings', c.strings, 'geracao.strings');
  return { dados: d, sugeridos, calculo: calcular(d) };
}

export function validar(dados) {
  const d = mesclar(projetoVazio(), dados);
  const c = calcular(d);
  const e = d.entrada;
  const g = d.geracao;
  const conc = getConcessionaria(d.concessionaria);
  const msgs = [];
  const erro = (campo, msg) => msgs.push({ nivel: 'erro', campo, msg });
  const aviso = (campo, msg) => msgs.push({ nivel: 'aviso', campo, msg });

  if (!conc) erro('concessionaria', 'Escolha a concessionária do projeto.');
  if (!d.cliente.nome) erro('cliente.nome', 'Informe o nome do cliente.');
  if (!d.cliente.uc) aviso('cliente.uc', 'Número da UC (instalação) não informado.');
  if (!d.cliente.endereco) aviso('cliente.endereco', 'Endereço não informado.');
  if (!e.fases) erro('entrada.fases', 'Informe o tipo de ligação (mono, bi ou tri).');
  if (!e.tensao) erro('entrada.tensao', 'Informe a tensão de fornecimento.');
  if (!num(e.disjuntorGeralA)) erro('entrada.disjuntorGeralA', 'Informe o disjuntor geral (A).');
  if (!num(e.bitolaFaseMm2)) erro('entrada.bitolaFaseMm2', 'Informe a bitola dos cabos de entrada (fase).');
  if (!num(e.bitolaNeutroMm2)) aviso('entrada.bitolaNeutroMm2', 'Informe a bitola do neutro.');
  if (!g.moduloMarca || !g.moduloModelo) erro('geracao.moduloModelo', 'Informe marca e modelo dos módulos.');
  if (!num(g.moduloPotenciaW)) erro('geracao.moduloPotenciaW', 'Informe a potência do módulo (W).');
  if (!num(g.moduloQuantidade)) erro('geracao.moduloQuantidade', 'Informe a quantidade de módulos.');
  if (!g.inversorMarca || !g.inversorModelo) erro('geracao.inversorModelo', 'Informe marca e modelo do inversor.');
  if (!num(g.inversorPotenciaKw)) erro('geracao.inversorPotenciaKw', 'Informe a potência nominal CA do inversor (kW).');
  if (!g.inversorInmetro) aviso('geracao.inversorInmetro', 'Número de registro INMETRO do inversor não informado.');
  if (!d.responsavel.nome || !d.responsavel.registro) aviso('responsavel.nome', 'Responsável técnico e registro CREA/CFT não informados.');

  if (conc) {
    if (e.categoria && !getCategoria(conc.id, e.categoria)) {
      aviso('entrada.categoria', `Categoria "${e.categoria}" não existe na tabela da ${conc.nome}. Categorias válidas: ${conc.categorias.map((k) => k.codigo).join(', ')}.`);
    }
    const k = c.categoria;
    if (k) {
      if (e.fases && k.fases !== e.fases) aviso('entrada.categoria', `Categoria ${k.codigo} é ${k.fases}fásica, mas a ligação informada é ${e.fases}.`);
      if (num(e.disjuntorGeralA) && num(e.disjuntorGeralA) !== k.disjuntorA) aviso('entrada.disjuntorGeralA', `Disjuntor geral de ${e.disjuntorGeralA} A difere do previsto para a categoria ${k.codigo} (${k.disjuntorA} A) na ${conc.nome}.`);
      if (num(e.bitolaFaseMm2) && num(e.bitolaFaseMm2) < k.bitolaMm2) aviso('entrada.bitolaFaseMm2', `Bitola de entrada ${e.bitolaFaseMm2} mm² menor que a da categoria ${k.codigo} (${k.bitolaMm2} mm²).`);
    }
    if (conc.medicaoDiretaMaxA && num(e.disjuntorGeralA) > conc.medicaoDiretaMaxA && (e.medicao || c.medicao) === 'direta') {
      erro('entrada.medicao', `Disjuntor acima de ${conc.medicaoDiretaMaxA} A exige medição indireta (TCs) na ${conc.nome}.`);
    }
    if (conc.neutroObrigatorio && e.neutroDisponivel === false) erro('entrada.neutroDisponivel', 'O padrão precisa ter neutro desde a entrada até o disjuntor (medidor bidirecional). Prever adequação.');
    if (conc.monoExigeCaixaPolifasica && e.fases === 'mono') aviso('entrada.tipoCaixa', 'Elektro: cliente monofásico com microgeração precisa de caixa de medição polifásica.');
    if (Number.isFinite(c.limiteMicrogeradorKw) && c.potenciaInversoresKw > c.limiteMicrogeradorKw) {
      erro('geracao.inversorPotenciaKw', `Potência dos inversores (${fmt(c.potenciaInversoresKw)} kW) acima do limite de ${c.limiteMicrogeradorKw} kW para categoria ${c.categoria.codigo} com conexão ${c.conexaoInversor} (GED 15303, Anexo H).`);
    }
    if (conc.inversorDeclaracaoAcimaKw && num(g.inversorPotenciaKw) > conc.inversorDeclaracaoAcimaKw) {
      aviso('geracao.inversorInmetro', `Inversor acima de ${conc.inversorDeclaracaoAcimaKw} kW: anexar declaração de conformidade do fabricante.`);
    }
  }
  if (c.potenciaMicrogeracaoKw > 75) erro('geracao.inversorPotenciaKw', 'Potência acima de 75 kW não é microgeração (minigeração: outro processo).');
  if (Number.isFinite(c.potenciaPicoKwp) && Number.isFinite(c.potenciaInversoresKw)) {
    const ratio = c.potenciaPicoKwp / c.potenciaInversoresKw;
    if (ratio > 1.5) aviso('geracao.moduloQuantidade', `Relação CC/CA de ${fmt(ratio)} (acima de 1,5): confira o carregamento do inversor.`);
    if (ratio < 0.8) aviso('geracao.moduloQuantidade', `Relação CC/CA de ${fmt(ratio)}: inversor superdimensionado.`);
  }
  if (Number.isFinite(c.correnteInversorA) && num(g.disjuntorInversorA) && num(g.disjuntorInversorA) < c.correnteInversorA) {
    erro('geracao.disjuntorInversorA', `Disjuntor do inversor (${g.disjuntorInversorA} A) menor que a corrente nominal (${fmt(c.correnteInversorA, 1)} A).`);
  }
  if (num(g.disjuntorInversorA) && num(e.disjuntorGeralA) && num(g.disjuntorInversorA) > num(e.disjuntorGeralA)) {
    aviso('geracao.disjuntorInversorA', 'Disjuntor do inversor maior que o disjuntor geral.');
  }
  if (num(g.caboCAMm2) && num(g.disjuntorInversorA)) {
    const amp = AMPACIDADE_CA.find(([s]) => s === num(g.caboCAMm2));
    if (amp && amp[1] < num(g.disjuntorInversorA)) aviso('geracao.caboCAMm2', `Cabo CA de ${g.caboCAMm2} mm² (≈${amp[1]} A) não é protegido pelo disjuntor de ${g.disjuntorInversorA} A.`);
  }
  return msgs;
}

/** Lista de materiais padrão (o usuário pode editar na tela). */
export function gerarMateriais(dados) {
  const d = mesclar(projetoVazio(), dados);
  const c = calcular(d);
  const g = d.geracao;
  const e = d.entrada;
  const qtdMod = num(g.moduloQuantidade) || 0;
  const strings = Number.isFinite(c.strings) ? c.strings : 1;
  const distCC = num(g.distanciaArranjoInversorM) || 15;
  const distCA = num(g.distanciaInversorQuadroM) || 10;
  const condCA = { FN: 2, FF: 2, FFFN: 4 }[c.conexaoInversor] || 3;
  const nDps = { FN: 2, FF: 3, FFFN: 4 }[c.conexaoInversor] || 3;
  const telha = d.telhado.tipoTelha || 'telhado';
  const itens = [
    { grupo: 'Geração', descricao: `Módulo fotovoltaico ${g.moduloMarca} ${g.moduloModelo} ${g.moduloPotenciaW ? g.moduloPotenciaW + ' W' : ''}`.replace(/\s+/g, ' ').trim(), unidade: 'un', quantidade: qtdMod },
    { grupo: 'Geração', descricao: `Inversor ${g.inversorMarca} ${g.inversorModelo} ${g.inversorPotenciaKw ? g.inversorPotenciaKw + ' kW' : ''}`.replace(/\s+/g, ' ').trim(), unidade: 'un', quantidade: num(g.inversorQuantidade) || 1 },
    { grupo: 'Estrutura', descricao: `Estrutura de fixação para ${telha} (perfis, ganchos/fixadores, grampos)`, unidade: 'conj. p/ módulo', quantidade: qtdMod },
    { grupo: 'Circuito CC', descricao: `Cabo solar 1x${g.caboCCMm2 || 6} mm² 1,8 kV CC – preto`, unidade: 'm', quantidade: Math.ceil(strings * distCC * 1.1) },
    { grupo: 'Circuito CC', descricao: `Cabo solar 1x${g.caboCCMm2 || 6} mm² 1,8 kV CC – vermelho`, unidade: 'm', quantidade: Math.ceil(strings * distCC * 1.1) },
    { grupo: 'Circuito CC', descricao: 'Conector MC4 (par macho/fêmea)', unidade: 'par', quantidade: strings * 2 + 2 },
  ];
  if (g.stringBox) {
    itens.push({ grupo: 'Circuito CC', descricao: `String box CC ${strings} entrada(s) com chave seccionadora e DPS CC 1000 V`, unidade: 'un', quantidade: 1 });
  }
  itens.push(
    { grupo: 'Circuito CA', descricao: `Disjuntor termomagnético ${c.polosInversor || ''} ${g.disjuntorInversorA || c.disjuntorInversorSugeridoA || ''} A curva C (proteção do inversor)`.replace(/\s+/g, ' '), unidade: 'un', quantidade: num(g.inversorQuantidade) || 1 },
    { grupo: 'Circuito CA', descricao: 'DPS CA classe II 275 V 20 kA', unidade: 'un', quantidade: nDps },
    { grupo: 'Circuito CA', descricao: `Cabo flexível 1x${g.caboCAMm2 || c.caboCASugeridoMm2 || 6} mm² 750 V (fases e neutro)`, unidade: 'm', quantidade: Math.ceil(distCA * condCA * 1.1) },
    { grupo: 'Circuito CA', descricao: `Cabo flexível 1x${g.caboCAMm2 || c.caboCASugeridoMm2 || 6} mm² 750 V verde (proteção)`, unidade: 'm', quantidade: Math.ceil(distCA * 1.1) },
    { grupo: 'Circuito CA', descricao: 'Quadro de proteção CA (caixa sobrepor com trilho DIN)', unidade: 'un', quantidade: 1 },
    { grupo: 'Infraestrutura', descricao: 'Eletroduto/eletrocalha com conexões e abraçadeiras', unidade: 'm', quantidade: Math.ceil(distCC + distCA) },
  );
  if (d.telhado.condulete) itens.push({ grupo: 'Infraestrutura', descricao: 'Condulete com tampa', unidade: 'un', quantidade: 2 });
  itens.push(
    { grupo: 'Aterramento', descricao: 'Haste de aterramento cobreada 5/8" x 2,40 m com conector', unidade: 'un', quantidade: 1 },
    { grupo: 'Aterramento', descricao: 'Cabo de cobre 1x6 mm² verde para equipotencialização da estrutura', unidade: 'm', quantidade: Math.ceil(distCC * 1.1) },
    { grupo: 'Sinalização', descricao: 'Placa de advertência "Cuidado – risco de choque elétrico – geração própria"', unidade: 'un', quantidade: 1 },
    { grupo: 'Diversos', descricao: 'Terminais, anilhas, abraçadeiras e fita isolante', unidade: 'vb', quantidade: 1 },
  );
  if (e.adequacaoPadrao) itens.push({ grupo: 'Padrão de entrada', descricao: 'Adequação do padrão de entrada (conforme norma da concessionária)', unidade: 'vb', quantidade: 1 });
  return itens.map((it, i) => ({ item: i + 1, ...it }));
}
