// Regras por concessionária.
//
// Cada categoria traz: fases, tensão (FN/FF), disjuntor geral (A), bitola sugerida do
// ramal de entrada (mm², cobre) e tipo de medição. Os valores vêm das normas de padrão
// de entrada da pasta "Modelos e Instruções". "conferido: true" indica que a tabela foi
// transcrita e conferida com a norma; nas demais a bitola é só sugestão e o projetista
// deve confirmar na norma antes de assinar.

/** @typedef {'mono'|'bi'|'tri'} Fases */

const cat = (codigo, fases, tensao, disjuntorA, bitolaMm2, medicao = 'direta', extra = {}) => ({
  codigo, fases, tensao, disjuntorA, bitolaMm2, medicao, ...extra,
});

export const CONCESSIONARIAS = {
  CPFL: {
    id: 'CPFL',
    nome: 'CPFL',
    distribuidoras: ['CPFL Paulista', 'CPFL Piratininga', 'CPFL Santa Cruz', 'RGE'],
    conferido: true,
    normas: [
      'GED 15303 v13.0 (22/12/2025) – Conexão de Micro e Minigeração Distribuída sob Sistema de Compensação de Energia Elétrica',
      'GED 13 v2.25 – Fornecimento em Tensão Secundária de Distribuição',
      'Material de Apoio para Apresentação de Projetos de Microgeração Distribuída (CPFL, mar/2023)',
    ],
    tensoes: ['127/220', '220/380'],
    // GED 13, Tabela 1A (127/220 V) e 1B (220/380 V), ramal de entrada cobre PVC 70 °C.
    categorias: [
      cat('A1', 'mono', '127/220', 32, 6),
      cat('A2', 'mono', '127/220', 63, 16),
      cat('B1', 'bi', '127/220', 63, 16),
      cat('B2', 'bi', '127/220', 80, 25),
      cat('C1', 'tri', '127/220', 63, 16),
      cat('C2', 'tri', '127/220', 80, 25),
      cat('C3', 'tri', '127/220', 100, 35),
      cat('C4', 'tri', '127/220', 125, 50, 'indireta'),
      cat('C5', 'tri', '127/220', 150, 70, 'indireta'),
      cat('C6', 'tri', '127/220', 200, 95, 'indireta'),
      cat('A3', 'mono', '220/380', 32, 6),
      cat('A4', 'mono', '220/380', 63, 16),
      cat('B3', 'bi', '220/380', 63, 16),
      cat('C7', 'tri', '220/380', 40, 10),
      cat('C8', 'tri', '220/380', 63, 16),
      cat('C9', 'tri', '220/380', 80, 25),
      cat('C10', 'tri', '220/380', 100, 35),
      cat('C11', 'tri', '220/380', 125, 50, 'indireta'),
    ],
    // GED 15303, Anexo H: potência nominal máxima do microgerador (kW) por categoria e tipo de conexão do inversor.
    limiteMicrogeradorKw: {
      A1: { FN: 4 }, A2: { FN: 8 }, A3: { FN: 7 }, A4: { FN: 13 },
      B1: { FN: 8, FF: 13 }, B2: { FN: 10, FF: 17 }, B3: { FN: 13, FF: 23 },
      C1: { FN: 6, FF: 11, FFFN: 18 }, C2: { FN: 9, FF: 17, FFFN: 28 }, C3: { FN: 12, FF: 22, FFFN: 38 },
      C4: { FN: 15, FF: 27, FFFN: 47 }, C5: { FN: 19, FF: 33, FFFN: 57 }, C6: { FN: 25, FF: 44, FFFN: 75 },
      C7: { FN: 8, FF: 15, FFFN: 26 }, C8: { FN: 13, FF: 23, FFFN: 41 }, C9: { FN: 17, FF: 30, FFFN: 52 },
      C10: { FN: 22, FF: 38, FFFN: 66 }, C11: { FN: 27, FF: 47, FFFN: 75 },
    },
    medicaoDiretaMaxA: 100,
    neutroObrigatorio: true,
    inversorDeclaracaoAcimaKw: 10,
    observacoes: [
      'O neutro deve estar disponível desde a entrada, passando pelo medidor, até o disjuntor geral (medidor bidirecional não funciona sem neutro).',
      'Categorias C4, C5 e C6 exigem medição indireta: chave seccionadora 200 A sem proteção antes do medidor, TCs e bloco de aferição.',
      'Inversores até 10 kW: anexar registro INMETRO ativo. Acima de 10 kW: declaração de conformidade do fabricante (NBR 16149, NBR 16150 e NBR IEC 62116).',
      'Instalar placa de advertência conforme GED 15303, Anexo C, junto ao padrão de entrada.',
      'Cabos de 50, 70 e 95 mm² entre seccionadora, medidor e proteção devem ser flexíveis (classe 5).',
    ],
  },

  ENEL: {
    id: 'ENEL',
    nome: 'Enel',
    distribuidoras: ['Enel São Paulo', 'Enel Rio', 'Enel Ceará'],
    conferido: false,
    normas: [
      'GRI-EDBR-CNC-GRI-0005 v05 (30/07/2024) – Conexão de Micro e Minigeração Distribuída',
      'CNC-OMBR-MAT-24-1569-EDBR v01 – Fornecimento de energia em BT (Anexo A, rede aérea 127/220 V)',
    ],
    tensoes: ['127/220', '120/240'],
    // CNC-OMBR-MAT-24-1569, Anexo A (aérea 127/220 V). Bitolas: conferir na norma.
    categorias: [
      cat('A1', 'mono', '127/220', 40, 10),
      cat('A2', 'mono', '127/220', 63, 16),
      cat('B1', 'bi', '127/220', 50, 10),
      cat('B2', 'bi', '127/220', 63, 16),
      cat('C1', 'tri', '127/220', 40, 10),
      cat('C2', 'tri', '127/220', 50, 10),
      cat('C3', 'tri', '127/220', 63, 16),
      cat('C4', 'tri', '127/220', 80, 25),
      cat('C5', 'tri', '127/220', 100, 35),
      cat('C6', 'tri', '127/220', 125, 50, 'direta', { medicaoAlternativa: 'indireta' }),
      cat('C7', 'tri', '127/220', 150, 70, 'direta', { medicaoAlternativa: 'indireta' }),
      cat('C8', 'tri', '127/220', 200, 95, 'indireta'),
    ],
    limiteMicrogeradorKw: {},
    medicaoDiretaMaxA: 200,
    neutroObrigatorio: true,
    observacoes: [
      'Atenção: o mesmo nome de categoria da CPFL (C1, C3…) tem disjuntor diferente na Enel.',
      'Enel SP também atende em delta com neutro 120/240 V e em rede subterrânea: conferir a tensão do local.',
      'Diagrama unifilar segundo o Anexo B, Desenho 01, da GRI-EDBR-CNC-GRI-0005.',
      'C6 e C7 podem ser medição direta com caixa polifásica para medidor de 200 A, mediante consulta prévia à distribuidora.',
    ],
  },

  EDP: {
    id: 'EDP',
    nome: 'EDP',
    distribuidoras: ['EDP São Paulo', 'EDP Espírito Santo'],
    conferido: false,
    normas: [
      'PT.DT.PDN.00059 v08 (14/04/2026) – Conexão de Microgeradores ao Sistema de Distribuição em BT',
      'PT.DT.PDN.00061 v12 – Fornecimento em BT (EDP Espírito Santo; conferir a versão de SP)',
    ],
    tensoes: ['127/220', '127/254'],
    categorias: [
      cat('U', 'mono', '127/220', 63, 16),
      cat('D', 'bi', '127/220', 63, 16),
      cat('T1', 'tri', '127/220', 63, 16),
      cat('T2', 'tri', '127/220', 80, 25),
      cat('T3', 'tri', '127/220', 100, 35),
      cat('T4', 'tri', '127/220', 150, 70),
      cat('T5', 'tri', '127/220', 200, 120),
    ],
    limiteMicrogeradorKw: {},
    medicaoDiretaMaxA: 200,
    neutroObrigatorio: true,
    observacoes: [
      'A tabela de categorias na pasta é da EDP Espírito Santo. Para clientes em SP, conferir com a norma de fornecimento da EDP São Paulo.',
      'Instalar placa de advertência conforme PT.DT.PDN.00059.',
    ],
  },

  ELEKTRO: {
    id: 'ELEKTRO',
    nome: 'Neoenergia Elektro',
    distribuidoras: ['Neoenergia Elektro'],
    conferido: false,
    normas: [
      'DIS-NOR-031 – Conexão de Microgeradores ao Sistema de Distribuição (Neoenergia)',
      'DIS-NOR-030 rev05 (03/06/2024) – Fornecimento em Tensão Secundária (Tabela 3, Elektro)',
    ],
    tensoes: ['127/220', '220/380'],
    // DIS-NOR-030, Tabela 3. Bitola = ramal de entrada cobre XLPE/HEPR (conferir variante PVC).
    categorias: [
      cat('M1', 'mono', '127/220', 63, 10),
      cat('B0', 'bi', '127/220', 50, 10),
      cat('B1', 'bi', '127/220', 70, 16),
      cat('T0', 'tri', '127/220', 50, 10),
      cat('T1', 'tri', '127/220', 63, 16),
      cat('T2', 'tri', '127/220', 100, 35),
      cat('T3', 'tri', '127/220', 125, 50),
      cat('T4', 'tri', '127/220', 150, 70),
      cat('T5', 'tri', '127/220', 200, 95, 'indireta'),
      cat('M3', 'mono', '220/380', 63, 16),
      cat('T6', 'tri', '220/380', 32, 6),
      cat('T7', 'tri', '220/380', 40, 6),
    ],
    limiteMicrogeradorKw: {},
    medicaoDiretaMaxA: 150,
    neutroObrigatorio: true,
    monoExigeCaixaPolifasica: true,
    observacoes: [
      'Cliente monofásico com microgeração precisa de caixa de medição polifásica (DIS-NOR-030).',
      'O portal da Neoenergia gera o "Diagrama Unifilar do Sistema Fotovoltaico"; este desenho serve de apoio e conferência.',
    ],
  },
};

export const LISTA_CONCESSIONARIAS = Object.values(CONCESSIONARIAS).map((c) => ({
  id: c.id, nome: c.nome, distribuidoras: c.distribuidoras, tensoes: c.tensoes, conferido: c.conferido,
  categorias: c.categorias,
}));

export function getConcessionaria(id) {
  return CONCESSIONARIAS[String(id || '').toUpperCase()] || null;
}

export function getCategoria(concId, codigo) {
  const c = getConcessionaria(concId);
  if (!c || !codigo) return null;
  return c.categorias.find((k) => k.codigo.toUpperCase() === String(codigo).toUpperCase()) || null;
}

/**
 * Sugere a categoria a partir das fases, tensão e disjuntor geral informados.
 */
export function sugerirCategoria(concId, fases, tensao, disjuntorA) {
  const c = getConcessionaria(concId);
  if (!c || !fases) return null;
  const candidatas = c.categorias.filter((k) => k.fases === fases && (!tensao || k.tensao === tensao));
  if (!candidatas.length) return null;
  if (disjuntorA) {
    const exata = candidatas.find((k) => k.disjuntorA === Number(disjuntorA));
    if (exata) return exata;
    const acima = candidatas.filter((k) => k.disjuntorA >= Number(disjuntorA)).sort((a, b) => a.disjuntorA - b.disjuntorA);
    if (acima.length) return acima[0];
  }
  return null;
}
