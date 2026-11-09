import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { lerVistoria, lerVistoriaTexto, marcado } from '../src/extracao.js';
import { completar, validar, calcular, gerarMateriais } from '../src/projeto.js';
import { sugerirCategoria, getCategoria } from '../src/concessionarias.js';
import { desenharUnifilar } from '../src/unifilar.js';
import { gerarMemorial } from '../src/memorial.js';
import { gerarPlanilhaMateriais } from '../src/materiais.js';

const EXEMPLO = new URL('../exemplos/vistoria-exemplo-preenchida.pdf', import.meta.url);

const projeto = () => completar({
  concessionaria: 'CPFL',
  cliente: { nome: 'Cliente Teste', uc: '123', endereco: 'Rua A, 1 - Peruíbe/SP' },
  entrada: { fases: 'tri', tensao: '127/220', disjuntorGeralA: 63 },
  geracao: { moduloMarca: 'X', moduloModelo: 'M', moduloPotenciaW: 575, moduloQuantidade: 14, inversorMarca: 'Y', inversorModelo: 'I', inversorPotenciaKw: 8 },
}).dados;

test('marcado reconhece caixas de seleção', () => {
  assert.equal(marcado('( )Mono ( ) Bi (X) Tri', ['Mono', 'Bi', 'Tri']), 'Tri');
  assert.equal(marcado('(x)Mono ( ) Bi', ['Mono', 'Bi', 'Tri']), 'Mono');
  assert.equal(marcado('( ) Sim ( ) Não', ['Sim', 'N[ãa]o']), null);
});

test('lê a vistoria Solarmar preenchida (PDF)', async () => {
  const r = await lerVistoria(fs.readFileSync(EXEMPLO), 'application/pdf', 'vistoria.pdf');
  assert.equal(r.metodo, 'texto');
  const d = r.dados;
  assert.equal(d.cliente.nome, 'Maria Aparecida dos Santos');
  assert.equal(d.cliente.uc, '4003219876');
  assert.equal(d.cliente.dataVistoria, '03/11/2026');
  assert.equal(d.cliente.cidade, 'Peruíbe');
  assert.equal(d.entrada.fases, 'tri');
  assert.equal(d.entrada.tensao, '127/220');
  assert.equal(d.entrada.disjuntorGeralA, 63);
  assert.equal(d.entrada.numeroMedidor, '18273645');
  assert.equal(d.entrada.tipoMedidor, 'digital');
  assert.equal(d.entrada.adequacaoPadrao, false);
  assert.equal(d.geracao.disjuntorInversorA, 32);
  assert.equal(d.geracao.moduloQuantidade, 14);
  assert.equal(d.geracao.moduloMarca, 'Canadian Solar');
  assert.equal(d.geracao.moduloPotenciaW, 575);
  assert.equal(d.geracao.inversorMarca, 'Growatt');
  assert.equal(d.geracao.inversorPotenciaKw, 8);
  assert.equal(d.telhado.tipoTelha, 'Cerâmica');
  assert.equal(d.telhado.condulete, true);
});

test('formulário em branco não gera valores', () => {
  const r = lerVistoriaTexto('Cliente: UC:\nEndereço: Data:\nTipo de ligação: ( )Mono ( ) Bi ( ) Tri / ( ) 110 ( ) 220 ( ) 380');
  assert.equal(r.dados.cliente.nome, '');
  assert.equal(r.dados.entrada.fases, '');
});

test('categorias CPFL e Enel diferem para o mesmo código', () => {
  assert.equal(getCategoria('CPFL', 'C3').disjuntorA, 100);
  assert.equal(getCategoria('ENEL', 'C3').disjuntorA, 63);
  assert.equal(sugerirCategoria('CPFL', 'tri', '127/220', 63).codigo, 'C1');
  assert.equal(getCategoria('CPFL', 'C4').medicao, 'indireta');
});

test('completar sugere categoria, bitola e proteção', () => {
  const d = projeto();
  assert.equal(d.entrada.categoria, 'C1');
  assert.equal(d.entrada.bitolaFaseMm2, 16);
  assert.equal(d.entrada.medicao, 'direta');
  assert.equal(d.distribuidora, 'CPFL Paulista');
  const c = calcular(d);
  assert.equal(Math.round(c.potenciaPicoKwp * 100) / 100, 8.05);
  assert.equal(c.potenciaMicrogeracaoKw, 8);
  assert.ok(d.geracao.disjuntorInversorA >= c.correnteInversorA);
});

test('validações da norma', () => {
  const d = projeto();
  d.geracao.disjuntorInversorA = 20;
  assert.ok(validar(d).some((m) => m.nivel === 'erro' && m.campo === 'geracao.disjuntorInversorA'));
  const ind = projeto();
  ind.entrada.disjuntorGeralA = 150; ind.entrada.categoria = 'C5'; ind.entrada.medicao = 'direta';
  assert.ok(validar(ind).some((m) => m.campo === 'entrada.medicao' && m.nivel === 'erro'));
  const lim = projeto();
  lim.geracao.inversorPotenciaKw = 20; lim.geracao.inversorConexao = 'FFFN';
  assert.ok(validar(lim).some((m) => m.msg.includes('Anexo H')));
  const sem = projeto(); sem.entrada.neutroDisponivel = false;
  assert.ok(validar(sem).some((m) => m.campo === 'entrada.neutroDisponivel'));
});

test('lista de materiais tem módulos, inversor e placa', () => {
  const itens = gerarMateriais(projeto());
  assert.equal(itens.find((i) => i.descricao.startsWith('Módulo')).quantidade, 14);
  assert.ok(itens.some((i) => /Placa de advertência/.test(i.descricao)));
});

test('unifilar gera DXF R12 com layers e textos', () => {
  const d = projeto();
  const dxf = desenharUnifilar(d).toDXF().toString('latin1');
  assert.match(dxf, /AC1009/);
  assert.match(dxf, /PROJETADO/);
  assert.match(dxf, /MEDIDOR/);
  assert.match(dxf, /3#16\(16\) mm² Cu/);
  assert.match(dxf, /EOF\r\n$/);
  const ind = projeto(); ind.entrada.categoria = 'C5'; ind.entrada.disjuntorGeralA = 150; ind.entrada.medicao = 'indireta';
  assert.match(desenharUnifilar(ind).toDXF().toString('latin1'), /TCs/);
});

test('memorial e planilha são arquivos Office válidos', async () => {
  const d = projeto();
  const mem = await gerarMemorial(d);
  const zip = await JSZip.loadAsync(mem);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /MEMORIAL DESCRITIVO/);
  assert.match(xml, /Cliente Teste/);
  const xlsx = await JSZip.loadAsync(await gerarPlanilhaMateriais(d));
  assert.ok(xlsx.file('xl/worksheets/sheet1.xml'));
});
