// Tabela de materiais (Excel .xlsx).
import ExcelJS from 'exceljs';
import { gerarMateriais, mesclar, projetoVazio, calcular, formatar, enderecoCompleto } from './projeto.js';

export async function gerarPlanilhaMateriais(dadosEntrada) {
  const d = mesclar(projetoVazio(), dadosEntrada);
  const itens = Array.isArray(d.materiais) && d.materiais.length ? d.materiais : gerarMateriais(d);
  const c = calcular(d);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Solarmar';
  const ws = wb.addWorksheet('Materiais', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 6 }, { width: 16 }, { width: 70 }, { width: 14 }, { width: 12 }];

  ws.mergeCells('A1:E1');
  ws.getCell('A1').value = 'SOLARMAR - TABELA DE MATERIAIS';
  ws.getCell('A1').font = { bold: true, size: 14 };
  const info = [
    ['Cliente', d.cliente.nome],
    ['UC', d.cliente.uc],
    ['Endereço', enderecoCompleto(d.cliente)],
    ['Concessionária', d.distribuidora || d.concessionaria],
    ['Sistema', `${formatar(c.potenciaPicoKwp) || '-'} kWp / ${formatar(c.potenciaInversoresKw) || '-'} kW CA`],
  ];
  info.forEach(([k, v], i) => {
    const r = ws.getRow(i + 2);
    r.getCell(1).value = k; r.getCell(1).font = { bold: true };
    ws.mergeCells(`B${i + 2}:E${i + 2}`);
    r.getCell(2).value = v || '';
  });
  const h = ws.getRow(8);
  h.values = ['Item', 'Grupo', 'Descrição', 'Unidade', 'Quantidade'];
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }; });
  itens.forEach((it, i) => {
    const r = ws.getRow(9 + i);
    r.values = [i + 1, it.grupo || '', it.descricao || '', it.unidade || '', Number(it.quantidade) || it.quantidade || ''];
    r.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }; });
  });
  ws.getRow(9 + itens.length + 1).getCell(3).value = 'Quantidades de cabos, eletrodutos e estrutura são estimativas: conferir no levantamento de campo.';
  ws.getRow(9 + itens.length + 1).getCell(3).font = { italic: true, size: 9 };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
