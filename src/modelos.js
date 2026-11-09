// Biblioteca de modelos de outros projetos (memoriais, unifilares, tabelas de materiais).
//
// Os arquivos enviados ficam guardados no servidor (pasta MODELOS_DIR, padrão ./data/modelos)
// e passam a ser considerados em todos os projetos seguintes:
//  - com a leitura por IA ativa, o texto dos modelos vai junto para o Claude, que sugere os
//    campos que a vistoria não traz (equipamentos, bitolas, categoria, responsável técnico...);
//  - tabelas de materiais em Excel servem para sugerir itens que a lista automática não tem.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { extrairTexto } from './extracao.js';

export const MODELOS_DIR = process.env.MODELOS_DIR || path.resolve('data', 'modelos');
const INDICE = () => path.join(MODELOS_DIR, 'indice.json');
export const EXTENSOES = ['pdf', 'docx', 'xlsx', 'dxf', 'txt', 'md', 'csv', 'json'];

const ext = (nome) => String(nome).toLowerCase().split('.').pop();

export function tipoModelo(nome) {
  const e = ext(nome);
  const n = String(nome).toLowerCase();
  if (e === 'dxf' || /unifilar|diagrama/.test(n)) return 'unifilar';
  if (e === 'xlsx' || e === 'csv' || /materia/.test(n)) return 'materiais';
  if (/memorial/.test(n)) return 'memorial';
  if (/vistoria/.test(n)) return 'vistoria';
  return 'outro';
}

async function lerIndice() {
  try { return JSON.parse(await fs.readFile(INDICE(), 'utf8')); } catch { return []; }
}
async function gravarIndice(lista) {
  await fs.mkdir(MODELOS_DIR, { recursive: true });
  await fs.writeFile(INDICE(), JSON.stringify(lista, null, 2));
}

/** Texto de um DXF: valores dos grupos 1 e 3 de TEXT/MTEXT/ATTRIB. */
export function textoDXF(buffer) {
  const linhas = buffer.toString('latin1').split(/\r?\n/);
  const out = [];
  let ent = '';
  for (let i = 0; i + 1 < linhas.length; i += 2) {
    const cod = linhas[i].trim(); const val = linhas[i + 1];
    if (cod === '0') ent = val.trim();
    else if ((cod === '1' || cod === '3') && ['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(ent)) {
      const t = val.replace(/\\P/g, '\n').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').trim();
      if (t) out.push(t);
    }
  }
  return out.join('\n');
}

/** Linhas de uma tabela de materiais (procura colunas Descrição / Unidade / Quantidade). */
export async function materiaisDeXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const itens = [];
  wb.eachSheet((ws) => {
    let col = null;
    ws.eachRow((row) => {
      const vals = (row.values || []).map((v) => (v && typeof v === 'object' ? (v.result ?? v.text ?? v.richText?.map((r) => r.text).join('') ?? '') : v));
      if (!col) {
        const idx = (re) => vals.findIndex((v) => typeof v === 'string' && re.test(v.trim()));
        const d = [/^descri[çc][ãa]o/i, /^(material|produto)/i, /^item$/i].map(idx).find((i) => i > 0) ?? -1;
        if (d > 0) col = { d, u: idx(/^(un\.?|unid|unidade)/i), q: idx(/^(qtd|quant)/i), g: idx(/^grupo/i) };
        return;
      }
      const descricao = String(vals[col.d] ?? '').trim();
      if (!descricao) return;
      // ignora notas de rodapé (sem unidade nem quantidade)
      if ((col.u > 0 || col.q > 0) && !String(vals[col.u] ?? '').trim() && !String(vals[col.q] ?? '').trim()) return;
      itens.push({
        grupo: col.g > 0 ? String(vals[col.g] ?? '') : '',
        descricao,
        unidade: col.u > 0 ? String(vals[col.u] ?? '') : '',
        quantidade: col.q > 0 ? vals[col.q] ?? '' : '',
      });
    });
  });
  return itens;
}

export async function textoDoModelo(buffer, nome, mimetype = '') {
  const e = ext(nome);
  if (e === 'dxf') return textoDXF(buffer);
  if (e === 'xlsx') {
    const itens = await materiaisDeXlsx(buffer).catch(() => []);
    return itens.map((i) => [i.grupo, i.descricao, i.unidade, i.quantidade].filter((x) => x !== '').join(' | ')).join('\n');
  }
  if (['txt', 'md', 'csv', 'json'].includes(e)) return buffer.toString('utf8');
  return extrairTexto(buffer, mimetype, nome);
}

export async function listarModelos() {
  return (await lerIndice()).map(({ id, nome, tipo, tamanho, caracteres, criadoEm }) => ({ id, nome, tipo, tamanho, caracteres, criadoEm }));
}

/** Guarda os arquivos na biblioteca. Retorna { adicionados, recusados }. */
export async function salvarModelos(arquivos) {
  const indice = await lerIndice();
  const adicionados = []; const recusados = [];
  await fs.mkdir(MODELOS_DIR, { recursive: true });
  for (const f of arquivos) {
    const nome = Buffer.from(f.originalname, 'latin1').toString('utf8');
    if (!EXTENSOES.includes(ext(nome))) {
      recusados.push({ nome, motivo: ext(nome) === 'dwg' ? 'DWG não pode ser lido: salve como DXF no AutoCAD e envie de novo.' : `Formato .${ext(nome)} não suportado.` });
      continue;
    }
    let texto = '';
    try { texto = (await textoDoModelo(f.buffer, nome, f.mimetype)) || ''; } catch (err) { recusados.push({ nome, motivo: `Não foi possível ler: ${err.message}` }); continue; }
    if (!texto.trim()) { recusados.push({ nome, motivo: 'Sem texto legível (arquivo escaneado?).' }); continue; }
    const hash = crypto.createHash('sha1').update(f.buffer).digest('hex');
    if (indice.some((m) => m.hash === hash)) { recusados.push({ nome, motivo: 'Este arquivo já está na biblioteca.' }); continue; }
    const id = crypto.randomUUID();
    await fs.writeFile(path.join(MODELOS_DIR, `${id}.${ext(nome)}`), f.buffer);
    await fs.writeFile(path.join(MODELOS_DIR, `${id}.txt`), texto);
    const item = { id, nome, tipo: tipoModelo(nome), tamanho: f.buffer.length, caracteres: texto.length, hash, criadoEm: new Date().toISOString() };
    indice.push(item);
    adicionados.push(item);
  }
  await gravarIndice(indice);
  return { adicionados, recusados };
}

export async function removerModelo(id) {
  const indice = await lerIndice();
  const m = indice.find((x) => x.id === id);
  if (!m) return false;
  await Promise.all([`${id}.${ext(m.nome)}`, `${id}.txt`].map((f) => fs.rm(path.join(MODELOS_DIR, f), { force: true })));
  await gravarIndice(indice.filter((x) => x.id !== id));
  return true;
}

/**
 * Textos dos modelos para enviar à IA, do mais recente ao mais antigo, até o limite de caracteres.
 * Retorna também os que ficaram de fora, para avisar o usuário.
 */
export async function textosModelos(limite = Number(process.env.MODELOS_LIMITE_CARACTERES) || 200000) {
  const indice = (await lerIndice()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const usados = []; const deFora = [];
  let total = 0;
  for (const m of indice) {
    const texto = await fs.readFile(path.join(MODELOS_DIR, `${m.id}.txt`), 'utf8').catch(() => '');
    if (!texto) continue;
    if (total + texto.length > limite) { deFora.push(m.nome); continue; }
    total += texto.length;
    usados.push({ nome: m.nome, tipo: m.tipo, texto });
  }
  return { usados, deFora };
}

const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Itens das tabelas de materiais da biblioteca que não aparecem na lista atual. */
export async function materiaisSugeridos(listaAtual = []) {
  const indice = await lerIndice();
  const existentes = listaAtual.map((i) => normalizar(i.descricao));
  const tokens = (s) => new Set(s.split(' ').filter((t) => t.length > 1 && !['de', 'da', 'do', 'com', 'para', 'p'].includes(t)));
  const conjuntos = existentes.map(tokens);
  // parecido = 60% ou mais das palavras do item do modelo já aparecem num item da lista atual
  const parecido = (d) => { const t = [...tokens(d)]; return t.length > 0 && conjuntos.some((e) => t.filter((x) => e.has(x)).length / t.length >= 0.6); };
  const vistos = new Set();
  const out = [];
  for (const m of indice.filter((x) => ext(x.nome) === 'xlsx')) {
    const buf = await fs.readFile(path.join(MODELOS_DIR, `${m.id}.xlsx`)).catch(() => null);
    if (!buf) continue;
    for (const it of await materiaisDeXlsx(buf).catch(() => [])) {
      const d = normalizar(it.descricao);
      if (d.length < 4 || vistos.has(d) || parecido(d)) continue;
      vistos.add(d);
      out.push({ grupo: `Modelo: ${m.nome}`.slice(0, 60), descricao: it.descricao, unidade: it.unidade || 'un', quantidade: '', origem: 'modelo' });
    }
  }
  return out;
}
