import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modelos-'));
process.env.MODELOS_DIR = dir;
const M = await import('../src/modelos.js');
const { aplicarSugestoes } = await import('../src/extracao.js');
const { completar, gerarMateriais } = await import('../src/projeto.js');
const { desenharUnifilar } = await import('../src/unifilar.js');
const { gerarPlanilhaMateriais } = await import('../src/materiais.js');
const { gerarMemorial } = await import('../src/memorial.js');

const projeto = completar({
  concessionaria: 'CPFL', cliente: { nome: 'Modelo Antigo' },
  entrada: { fases: 'tri', tensao: '127/220', disjuntorGeralA: 63 },
  geracao: { moduloMarca: 'JA', moduloModelo: 'JAM72', moduloPotenciaW: 550, moduloQuantidade: 10, inversorMarca: 'Growatt', inversorModelo: 'MIN 5000', inversorPotenciaKw: 5 },
  responsavel: { nome: 'Eng. Fulano', registro: 'CREA-SP 123' },
}).dados;

before(async () => {
  const mats = [...gerarMateriais(projeto), { grupo: 'Extra', descricao: 'Kit de limpeza de módulos', unidade: 'un', quantidade: 1 }];
  const arquivos = [
    { originalname: Buffer.from('Tabela de materiais - João.xlsx').toString('latin1'), buffer: await gerarPlanilhaMateriais({ ...projeto, materiais: mats }), mimetype: '' },
    { originalname: 'unifilar antigo.dxf', buffer: desenharUnifilar(projeto).toDXF(), mimetype: '' },
    { originalname: 'memorial antigo.docx', buffer: await gerarMemorial(projeto), mimetype: '' },
    { originalname: 'projeto.dwg', buffer: Buffer.from('AC1032'), mimetype: '' },
  ];
  const r = await M.salvarModelos(arquivos);
  assert.equal(r.adicionados.length, 3);
  assert.match(r.recusados[0].motivo, /DXF/);
});

test('biblioteca guarda, lista e evita duplicados', async () => {
  const lista = await M.listarModelos();
  assert.equal(lista.length, 3);
  assert.ok(lista.some((m) => m.nome === 'Tabela de materiais - João.xlsx' && m.tipo === 'materiais'));
  assert.ok(lista.some((m) => m.tipo === 'unifilar'));
  const dup = await M.salvarModelos([{ originalname: 'unifilar antigo.dxf', buffer: desenharUnifilar(projeto).toDXF() }]);
  assert.equal(dup.adicionados.length, 0);
});

test('textos dos modelos incluem DXF e memorial', async () => {
  const { usados, deFora } = await M.textosModelos();
  assert.equal(deFora.length, 0);
  assert.ok(usados.find((u) => u.tipo === 'unifilar').texto.includes('MEDIDOR'));
  assert.ok(usados.find((u) => u.tipo === 'memorial').texto.includes('Eng. Fulano'));
  const pouco = await M.textosModelos(10);
  assert.equal(pouco.usados.length, 0);
  assert.equal(pouco.deFora.length, 3);
});

test('tabelas da biblioteca sugerem só itens que faltam', async () => {
  const itens = await M.materiaisSugeridos(gerarMateriais(projeto));
  assert.deepEqual(itens.map((i) => i.descricao), ['Kit de limpeza de módulos']);
});

test('remover modelo', async () => {
  const [m] = await M.listarModelos();
  assert.equal(await M.removerModelo(m.id), true);
  assert.equal((await M.listarModelos()).length, 2);
});

test('sugestões dos modelos só preenchem campos vazios', () => {
  const d = completar({ cliente: { nome: 'X' }, responsavel: { nome: 'Já preenchido' } }).dados;
  const { aplicados } = aplicarSugestoes(d, [
    { campo: 'responsavel.nome', valor: 'Outro', fonte: 'm1' },
    { campo: 'responsavel.registro', valor: 'CREA 1', fonte: 'm1' },
    { campo: 'geracao.caboCCMm2', valor: '6 mm²', fonte: 'm2' },
    { campo: 'concessionaria', valor: 'CPFL Piratininga', fonte: 'm3' },
    { campo: 'cliente.nome', valor: 'Não pode', fonte: 'm4' },
  ]);
  assert.equal(d.responsavel.nome, 'Já preenchido');
  assert.equal(d.responsavel.registro, 'CREA 1');
  assert.equal(d.concessionaria, 'CPFL');
  assert.deepEqual(aplicados.sort(), ['concessionaria', 'responsavel.registro']);
});
