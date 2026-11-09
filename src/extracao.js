// Leitura da vistoria técnica Solarmar (PDF, DOCX ou imagem).
//
// 1) Se ANTHROPIC_API_KEY estiver configurada, o documento vai para o Claude, que devolve os
//    campos em JSON (funciona também com vistoria escrita à mão e fotografada/escaneada).
// 2) Sem chave, o texto do PDF/DOCX é lido e os campos são localizados pelos rótulos do
//    formulário (funciona com vistoria preenchida no computador).
// Em ambos os casos o resultado passa pela tela de revisão antes de gerar os documentos.
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { projetoVazio, mesclar, n } from './projeto.js';

export const MODELO_CLAUDE = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

// ---------- texto ----------

export async function extrairTexto(buffer, mimetype, nome = '') {
  const ext = nome.toLowerCase().split('.').pop();
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try { return (await parser.getText()).text || ''; } finally { await parser.destroy(); }
  }
  if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return (await mammoth.extractRawText({ buffer })).value || '';
  }
  if (ext === 'txt' || mimetype?.startsWith('text/')) return buffer.toString('utf8');
  return '';
}

// ---------- leitura por rótulos ----------

const ROTULOS = [
  ['cliente', /Cliente\s*:/i],
  ['uc', /\bUC\s*:/],
  ['endereco', /Endere[çc]o\s*:/i],
  ['data', /\bData\s*:/i],
  ['tipoTelha', /Tipo de telha\s*:/i],
  ['estrutura', /Tipo de estrutura de suporte\s*:/i],
  ['estruturaTelhado', /Estrutura do telhado\s*:/i],
  ['distanciaVigas', /Dist[âa]ncia entre vigas\/caibros\s*:/i],
  ['quedas', /N[úu]mero de quedas\s*:/i],
  ['geometria', /Geometria do telhado\s*:/i],
  ['dimensoes', /Dimens[õo]es do telhado\s*:/i],
  ['acessibilidade', /Acessibilidade\s*:/i],
  ['qtdPlacas', /Quantidade de placas a serem instaladas\s*:/i],
  ['observacoesTelhado', /Observa[çc][õo]es\s*:/i],
  ['conexaoRede', /CONEX[ÃA]O DE REDE/],
  ['tipoLigacao', /Tipo de liga[çc][ãa]o\s*:/i],
  ['fotoRelogio', /Foto do rel[óo]gio\s*:/i],
  ['medidor', /N[º°o]\.? do medidor\s*:/i],
  ['fotoConta', /Foto da conta\s*:/i],
  ['condulete', /Necessidade de condulete\s*:/i],
  ['aterramento', /Aterramento\s*:/i],
  ['obsAbaixo', /OBSERVA[ÇC][ÕO]ES ABAIXO\s*:/i],
  ['disjuntorGeral', /Disjuntor geral\s*:/i],
  ['adequacao', /Poste Padr[ãa]o precisa de\s+adequa[çc][ãa]o\s*:/i],
  ['disjuntorInversor', /Disjuntor do inversor\s*:/i],
  ['sombreamento', /AN[ÁA]LISE DE SOMBREAMENTO[^\n]*/i],
  ['comentarios', /COMENT[ÁA]RIOS/],
  ['assinatura', /Assinatura do respons[áa]vel t[ée]cnico\s*:/i],
  ['qtdPaineis', /Quantidade de pain[ée]is\s*:/i],
  ['qtdInversores', /Quantidade de inversores\s*:/i],
  ['marca', /Marca\s*:/i],
  ['potencia', /Pot[êe]ncia\s*:/i],
  ['questionario', /Question[áa]rio de avalia[çc][ãa]o/i],
  ['secao', /ESPECIFICA[ÇC][ÕO]ES DO CLIENTE|INFORMA[ÇC][ÕO]ES DO TELHADO|VISTORIA T[ÉE]CNICA/],
  ['cabecalho', /SOLARMAR COM[ÉE]RCIO[^\n]*|Rua Vitorino Malaquias[^\n]*|CNPJ:[^\n]*|https?:\/\/www\.solarmar[^\n]*|Jos[ée] Alessandro Oshiro[^\n]*|\(13\) 99651-2018|jose\.oshiro@solarmar\.com\.br|-- \d+ of \d+ --/i],
];

const MARCA_CHECK = '[xX✓✔■●•*]';

/** Retorna a opção marcada, ex.: marcado('( )Mono (X) Bi', ['Mono','Bi','Tri']) -> 'Bi' */
export function marcado(trecho, opcoes) {
  for (const op of opcoes) {
    const re = new RegExp(`\\(\\s*${MARCA_CHECK}\\s*\\)\\s*${op}`, 'i');
    if (re.test(trecho)) return op;
  }
  for (const op of opcoes) { // variante "Mono (X)"
    const re = new RegExp(`${op}\\s*\\(\\s*${MARCA_CHECK}\\s*\\)`, 'i');
    if (re.test(trecho)) return op;
  }
  return null;
}

function limparValor(v) {
  return String(v || '')
    .replace(new RegExp(`\\(\\s*${MARCA_CHECK}?\\s*\\)\\s*[A-Za-zÀ-ú0-9]+`, 'g'), ' ')
    .replace(/_{3,}/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/^[\s/:-]+|[\s/:-]+$/g, '')
    .trim();
}

/** Divide o texto em segmentos {rotulo -> texto bruto até o próximo rótulo}. Mantém todas as ocorrências. */
export function segmentar(texto) {
  const achados = [];
  for (const [chave, re] of ROTULOS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(texto))) { achados.push({ chave, ini: m.index, fim: m.index + m[0].length }); if (!m[0].length) g.lastIndex++; }
  }
  achados.sort((a, b) => a.ini - b.ini || b.fim - a.fim);
  // remove rótulos contidos em outro (ex.: "Observações:" dentro de "OBSERVAÇÕES ABAIXO:")
  const filtrados = achados.filter((a, i) => !achados.some((b, j) => j !== i && b.ini <= a.ini && b.fim >= a.fim && (b.fim - b.ini) > (a.fim - a.ini)));
  const seg = {};
  filtrados.forEach((a, i) => {
    const prox = filtrados[i + 1];
    const bruto = texto.slice(a.fim, prox ? prox.ini : texto.length);
    (seg[a.chave] ||= []).push(bruto);
  });
  return seg;
}

export function lerVistoriaTexto(texto) {
  const dados = projetoVazio();
  const campos = [];
  if (!texto || !texto.trim()) return { dados, campos };

  // Seções: vistoria (pág. 1) e avaliação do cliente (pág. 3)
  const iApr = texto.search(/AN[ÁA]LISE PRELIMINAR DE RISCO/i);
  const iAval = texto.search(/AVALIA[ÇC][ÃA]O (DOS CLIENTES|DE SATISFA)/i);
  const vist = iApr > 0 ? texto.slice(0, iApr) : texto;
  const aval = iAval > 0 ? texto.slice(iAval) : '';
  const sv = segmentar(vist);
  const sa = segmentar(aval);
  const v = (seg, k, i = 0) => limparValor(seg[k]?.[i]);
  const bruto = (seg, k, i = 0) => seg[k]?.[i] || '';
  const set = (obj, campo, valor, caminho) => { if (valor !== null && valor !== undefined && valor !== '' && !Number.isNaN(valor)) { obj[campo] = valor; campos.push(caminho); } };

  set(dados.cliente, 'nome', v(sv, 'cliente'), 'cliente.nome');
  set(dados.cliente, 'uc', v(sv, 'uc'), 'cliente.uc');
  set(dados.cliente, 'endereco', v(sv, 'endereco'), 'cliente.endereco');
  set(dados.cliente, 'dataVistoria', v(sv, 'data'), 'cliente.dataVistoria');
  const end = dados.cliente.endereco;
  const mCid = end.match(/[-–,]\s*([A-Za-zÀ-ú' ]+?)\s*[/-]\s*([A-Z]{2})\s*$/);
  if (mCid) { set(dados.cliente, 'cidade', mCid[1].trim(), 'cliente.cidade'); set(dados.cliente, 'uf', mCid[2], 'cliente.uf'); }

  set(dados.telhado, 'tipoTelha', v(sv, 'tipoTelha'), 'telhado.tipoTelha');
  set(dados.telhado, 'estrutura', v(sv, 'estrutura'), 'telhado.estrutura');
  set(dados.telhado, 'estruturaTelhado', v(sv, 'estruturaTelhado'), 'telhado.estruturaTelhado');
  set(dados.telhado, 'distanciaVigas', v(sv, 'distanciaVigas'), 'telhado.distanciaVigas');
  set(dados.telhado, 'quedas', v(sv, 'quedas'), 'telhado.quedas');
  set(dados.telhado, 'geometria', v(sv, 'geometria'), 'telhado.geometria');
  set(dados.telhado, 'dimensoes', v(sv, 'dimensoes'), 'telhado.dimensoes');
  set(dados.telhado, 'acessibilidade', v(sv, 'acessibilidade'), 'telhado.acessibilidade');
  set(dados.telhado, 'observacoes', v(sv, 'observacoesTelhado'), 'telhado.observacoes');
  const qPlacas = n(v(sv, 'qtdPlacas'));
  set(dados.geracao, 'moduloQuantidade', Number.isFinite(qPlacas) ? qPlacas : '', 'geracao.moduloQuantidade');

  const lig = bruto(sv, 'tipoLigacao');
  const fase = marcado(lig, ['Mono', 'Bi', 'Tri']);
  if (fase) set(dados.entrada, 'fases', fase.toLowerCase(), 'entrada.fases');
  const tens = marcado(lig, ['110', '127', '220', '380']);
  if (tens) set(dados.entrada, 'tensao', tens === '380' ? '220/380' : '127/220', 'entrada.tensao');

  const med = bruto(sv, 'medidor');
  set(dados.entrada, 'numeroMedidor', limparValor(med), 'entrada.numeroMedidor');
  const tipoMed = marcado(med, ['Anal[óo]gico', 'Digital']);
  if (tipoMed) set(dados.entrada, 'tipoMedidor', /digital/i.test(tipoMed) ? 'digital' : 'analogico', 'entrada.tipoMedidor');

  const cond = marcado(bruto(sv, 'condulete'), ['Sim', 'N[ãa]o']);
  if (cond) set(dados.telhado, 'condulete', cond === 'Sim', 'telhado.condulete');
  set(dados.entrada, 'aterramento', v(sv, 'aterramento'), 'entrada.aterramento');

  const djg = v(sv, 'disjuntorGeral');
  const mdg = djg.match(/(\d{2,3})\s*A?/i);
  if (mdg) set(dados.entrada, 'disjuntorGeralA', Number(mdg[1]), 'entrada.disjuntorGeralA');
  const adq = marcado(bruto(sv, 'adequacao'), ['Sim', 'N[ãa]o']);
  if (adq) set(dados.entrada, 'adequacaoPadrao', adq === 'Sim', 'entrada.adequacaoPadrao');
  const dji = v(sv, 'disjuntorInversor');
  const mdi = dji.match(/(\d{1,3})\s*A?/i);
  if (mdi) set(dados.geracao, 'disjuntorInversorA', Number(mdi[1]), 'geracao.disjuntorInversorA');

  const coment = [v(sv, 'comentarios'), v(sv, 'obsAbaixo')].filter(Boolean).join(' ');
  set(dados, 'observacoes', coment, 'observacoes');

  // Avaliação do cliente: painéis e inversores (marca/potência)
  const qp = n(v(sa, 'qtdPaineis'));
  if (Number.isFinite(qp) && !dados.geracao.moduloQuantidade) set(dados.geracao, 'moduloQuantidade', qp, 'geracao.moduloQuantidade');
  const marcas = sa.marca || []; const pots = sa.potencia || [];
  if (marcas[0]) set(dados.geracao, 'moduloMarca', limparValor(marcas[0]), 'geracao.moduloMarca');
  const pm = n(limparValor(pots[0]));
  if (Number.isFinite(pm)) set(dados.geracao, 'moduloPotenciaW', pm, 'geracao.moduloPotenciaW');
  const qi = n(v(sa, 'qtdInversores'));
  if (Number.isFinite(qi)) set(dados.geracao, 'inversorQuantidade', qi, 'geracao.inversorQuantidade');
  if (marcas[1]) set(dados.geracao, 'inversorMarca', limparValor(marcas[1]), 'geracao.inversorMarca');
  const pi = n(limparValor(pots[1]));
  if (Number.isFinite(pi)) set(dados.geracao, 'inversorPotenciaKw', pi > 100 ? pi / 1000 : pi, 'geracao.inversorPotenciaKw');

  return { dados, campos };
}

// ---------- leitura com Claude ----------

const S = { type: ['string', 'null'] };
const N = { type: ['number', 'null'] };
const B = { type: ['boolean', 'null'] };
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });

export const ESQUEMA = obj({
  cliente: obj({ nome: S, cpfCnpj: S, uc: S, endereco: S, cidade: S, uf: S, dataVistoria: S }),
  concessionaria: { type: ['string', 'null'], enum: ['CPFL', 'ENEL', 'EDP', 'ELEKTRO', null] },
  distribuidora: S,
  entrada: obj({
    fases: { type: ['string', 'null'], enum: ['mono', 'bi', 'tri', null] },
    tensao: { type: ['string', 'null'], enum: ['127/220', '220/380', '120/240', '127/254', null] },
    categoria: S, disjuntorGeralA: N, bitolaFaseMm2: N, bitolaNeutroMm2: N,
    ramal: { type: ['string', 'null'], enum: ['aereo', 'subterraneo', null] },
    tipoCaixa: S,
    medicao: { type: ['string', 'null'], enum: ['direta', 'indireta', null] },
    numeroMedidor: S,
    tipoMedidor: { type: ['string', 'null'], enum: ['analogico', 'digital', null] },
    cargaInstaladaKw: N, neutroDisponivel: B, adequacaoPadrao: B, aterramento: S,
  }),
  geracao: obj({
    moduloMarca: S, moduloModelo: S, moduloPotenciaW: N, moduloQuantidade: N, moduloInmetro: S,
    inversorMarca: S, inversorModelo: S, inversorPotenciaKw: N, inversorQuantidade: N, inversorInmetro: S,
    disjuntorInversorA: N,
  }),
  telhado: obj({ tipoTelha: S, estrutura: S, estruturaTelhado: S, distanciaVigas: S, quedas: S, geometria: S, dimensoes: S, acessibilidade: S, condulete: B, observacoes: S }),
  observacoes: S,
  avisos: { type: 'array', items: { type: 'string' } },
});

const INSTRUCOES = `Você lê documentos de vistoria técnica da Solarmar (empresa de energia solar) para preparar o projeto de microgeração fotovoltaica.
O formulário "VISTORIA TÉCNICA" tem: Cliente, UC, Endereço, Data; informações do telhado; e "CONEXÃO DE REDE" com caixas de seleção ( ) para tipo de ligação (Mono/Bi/Tri e 110/220/380), nº do medidor (Analógico/Digital), condulete, aterramento, disjuntor geral, disjuntor do inversor e se o poste padrão precisa de adequação. A página "AVALIAÇÃO DOS CLIENTES" traz quantidade, marca e potência de painéis e inversores.
O documento pode estar preenchido à mão, escaneado ou fotografado, e pode vir acompanhado de conta de energia, fotos do padrão, datasheets ou proposta comercial.
Regras:
- Extraia apenas o que está escrito no documento. Use null quando o campo não aparecer ou estiver ilegível. Não invente valores.
- Tensão: 110 ou 220 marcado em rede 127/220 V -> "127/220"; 380 -> "220/380".
- Concessionária: só preencha se aparecer no documento (logo ou nome na conta de energia, por exemplo CPFL Piratininga, Enel, EDP, Neoenergia Elektro).
- Potência do módulo em W (ex.: 550). Potência do inversor em kW (ex.: 8000 W -> 8).
- Em "avisos", liste em português o que ficou ilegível ou ambíguo.`;

export function claudeDisponivel() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function lerVistoriaClaude(buffer, mimetype, nome, textoExtraido) {
  const client = new Anthropic();
  const ext = (nome || '').toLowerCase().split('.').pop();
  const conteudo = [];
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    conteudo.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } });
  } else if (/^image\/(png|jpe?g|gif|webp)$/.test(mimetype)) {
    conteudo.push({ type: 'image', source: { type: 'base64', media_type: mimetype === 'image/jpg' ? 'image/jpeg' : mimetype, data: buffer.toString('base64') } });
  } else {
    conteudo.push({ type: 'text', text: `Conteúdo do arquivo ${nome}:\n\n${textoExtraido}` });
  }
  conteudo.push({ type: 'text', text: 'Extraia os dados desta vistoria técnica conforme o esquema.' });

  const resp = await client.beta.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 16000,
    system: INSTRUCOES,
    messages: [{ role: 'user', content: conteudo }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (resp.stop_reason === 'refusal') throw new Error('O modelo recusou a leitura deste documento.');
  if (resp.stop_reason === 'max_tokens') throw new Error('Resposta do modelo cortada (max_tokens).');
  const txt = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const bruto = JSON.parse(txt);
  const avisos = bruto.avisos || [];
  delete bruto.avisos;

  // Remove nulos e registra os campos preenchidos
  const campos = [];
  const limpar = (o, prefixo = '') => {
    const out = {};
    for (const [k, val] of Object.entries(o)) {
      const cam = prefixo ? `${prefixo}.${k}` : k;
      if (val && typeof val === 'object' && !Array.isArray(val)) out[k] = limpar(val, cam);
      else if (val !== null && val !== '') { out[k] = val; campos.push(cam); }
    }
    return out;
  };
  return { dados: mesclar(projetoVazio(), limpar(bruto)), campos, avisos };
}

/** Ponto de entrada: decide o método e devolve { dados, campos, avisos, metodo }. */
export async function lerVistoria(buffer, mimetype, nome) {
  let texto = '';
  try { texto = await extrairTexto(buffer, mimetype, nome); } catch (err) { texto = ''; }
  const temTexto = texto.replace(/\s+/g, '').length > 50;

  if (claudeDisponivel()) {
    try {
      const r = await lerVistoriaClaude(buffer, mimetype, nome, texto);
      return { ...r, metodo: 'claude' };
    } catch (err) {
      const r = lerVistoriaTexto(texto);
      return { ...r, metodo: 'texto', avisos: [`Leitura com IA falhou (${err.message}). Dados lidos só pelo texto do arquivo.`] };
    }
  }
  if (!temTexto) {
    return {
      dados: projetoVazio(), campos: [], metodo: 'nenhum',
      avisos: ['Não há texto legível no arquivo (vistoria escaneada, foto ou escrita à mão). Configure a chave ANTHROPIC_API_KEY no servidor para ler esse tipo de documento, ou preencha os campos manualmente.'],
    };
  }
  const r = lerVistoriaTexto(texto);
  return { ...r, metodo: 'texto', avisos: r.campos.length ? [] : ['Nenhum campo do formulário de vistoria foi reconhecido. Confira se é o modelo Solarmar ou preencha manualmente.'] };
}
