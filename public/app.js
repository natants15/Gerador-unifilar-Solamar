// Interface do gerador: upload da vistoria -> revisão -> documentos.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const estado = {
  config: null,
  dados: null,
  lidos: new Set(),
  sugeridos: new Set(),
  materiaisEditados: false,
};

// ---------- definição do formulário ----------
const opcoes = (pares) => pares.map(([v, t]) => ({ v, t }));
const SECOES = [
  { titulo: 'Cliente', campos: [
    { p: 'cliente.nome', l: 'Nome do titular' },
    { p: 'cliente.cpfCnpj', l: 'CPF/CNPJ' },
    { p: 'cliente.uc', l: 'UC / nº da instalação' },
    { p: 'cliente.dataVistoria', l: 'Data da vistoria' },
    { p: 'cliente.endereco', l: 'Endereço', largo: true },
    { p: 'cliente.cidade', l: 'Cidade' },
    { p: 'cliente.uf', l: 'UF' },
    { p: 'cliente.latitude', l: 'Latitude (SIRGAS 2000)' },
    { p: 'cliente.longitude', l: 'Longitude (SIRGAS 2000)' },
  ] },
  { titulo: 'Concessionária', campos: [
    { p: 'concessionaria', l: 'Concessionária', tipo: 'select', opcoes: () => [{ v: '', t: '— escolha —' }, ...estado.config.concessionarias.map((c) => ({ v: c.id, t: c.nome + (c.conferido ? '' : ' (tabela a conferir)') }))] },
    { p: 'distribuidora', l: 'Distribuidora', tipo: 'select', opcoes: () => { const c = conc(); return [{ v: '', t: '—' }, ...(c ? c.distribuidoras.map((d) => ({ v: d, t: d })) : [])]; } },
  ] },
  { titulo: 'Padrão de entrada (existente)', campos: [
    { p: 'entrada.fases', l: 'Tipo de ligação', tipo: 'select', opcoes: () => opcoes([['', '—'], ['mono', 'Monofásica'], ['bi', 'Bifásica'], ['tri', 'Trifásica']]) },
    { p: 'entrada.tensao', l: 'Tensão (V)', tipo: 'select', opcoes: () => { const c = conc(); const t = c ? c.tensoes : ['127/220', '220/380']; return [{ v: '', t: '—' }, ...t.map((x) => ({ v: x, t: x }))]; } },
    { p: 'entrada.categoria', l: 'Categoria', tipo: 'select', opcoes: () => {
      const c = conc(); const e = estado.dados.entrada;
      const cats = c ? c.categorias.filter((k) => (!e.fases || k.fases === e.fases) && (!e.tensao || k.tensao === e.tensao)) : [];
      const lista = cats.map((k) => ({ v: k.codigo, t: `${k.codigo} – ${k.disjuntorA} A – ${k.bitolaMm2} mm²${k.medicao === 'indireta' ? ' – indireta' : ''}` }));
      if (e.categoria && !lista.some((o) => o.v === e.categoria)) lista.unshift({ v: e.categoria, t: `${e.categoria} (fora da tabela)` });
      return [{ v: '', t: c ? '— escolha —' : 'escolha a concessionária' }, ...lista];
    } },
    { p: 'entrada.disjuntorGeralA', l: 'Disjuntor geral (A)', tipo: 'number' },
    { p: 'entrada.bitolaFaseMm2', l: 'Cabo de entrada – fase (mm²)', tipo: 'number' },
    { p: 'entrada.bitolaNeutroMm2', l: 'Cabo de entrada – neutro (mm²)', tipo: 'number' },
    { p: 'entrada.medicao', l: 'Medição', tipo: 'select', opcoes: () => opcoes([['', '—'], ['direta', 'Direta'], ['indireta', 'Indireta (TCs)']]) },
    { p: 'entrada.ramal', l: 'Ramal', tipo: 'select', opcoes: () => opcoes([['aereo', 'Aéreo'], ['subterraneo', 'Subterrâneo']]) },
    { p: 'entrada.tipoCaixa', l: 'Caixa / poste padrão' },
    { p: 'entrada.numeroMedidor', l: 'Nº do medidor' },
    { p: 'entrada.tipoMedidor', l: 'Medidor atual', tipo: 'select', opcoes: () => opcoes([['', '—'], ['analogico', 'Analógico'], ['digital', 'Digital']]) },
    { p: 'entrada.cargaInstaladaKw', l: 'Carga instalada (kW)', tipo: 'number' },
    { p: 'entrada.aterramento', l: 'Aterramento', largo: true },
    { p: 'entrada.neutroDisponivel', l: 'Neutro disponível até o disjuntor', tipo: 'check' },
    { p: 'entrada.dpsEntrada', l: 'DPS no padrão de entrada', tipo: 'check' },
    { p: 'entrada.adequacaoPadrao', l: 'Padrão precisa de adequação', tipo: 'check' },
  ] },
  { titulo: 'Módulos fotovoltaicos', campos: [
    { p: 'geracao.moduloMarca', l: 'Marca' },
    { p: 'geracao.moduloModelo', l: 'Modelo (como no datasheet)' },
    { p: 'geracao.moduloPotenciaW', l: 'Potência unitária (Wp)', tipo: 'number' },
    { p: 'geracao.moduloQuantidade', l: 'Quantidade', tipo: 'number' },
    { p: 'geracao.strings', l: 'Nº de strings', tipo: 'number' },
    { p: 'geracao.moduloInmetro', l: 'Registro INMETRO' },
  ] },
  { titulo: 'Inversor', campos: [
    { p: 'geracao.inversorMarca', l: 'Marca' },
    { p: 'geracao.inversorModelo', l: 'Modelo (como no INMETRO)' },
    { p: 'geracao.inversorPotenciaKw', l: 'Potência nominal CA (kW)', tipo: 'number' },
    { p: 'geracao.inversorQuantidade', l: 'Quantidade', tipo: 'number' },
    { p: 'geracao.inversorConexao', l: 'Conexão à rede', tipo: 'select', opcoes: () => opcoes([['', '—'], ['FN', 'Monofásico FN'], ['FF', 'Monofásico FF (220 V)'], ['FFFN', 'Trifásico']]) },
    { p: 'geracao.inversorInmetro', l: 'Registro INMETRO' },
  ] },
  { titulo: 'Proteção e cabos do sistema gerador', campos: [
    { p: 'geracao.disjuntorInversorA', l: 'Disjuntor do inversor (A)', tipo: 'number' },
    { p: 'geracao.caboCAMm2', l: 'Cabo CA (mm²)', tipo: 'number' },
    { p: 'geracao.caboCCMm2', l: 'Cabo CC (mm²)', tipo: 'number' },
    { p: 'geracao.stringBox', l: 'String box (DPS CC + chave)', tipo: 'check' },
    { p: 'geracao.distanciaArranjoInversorM', l: 'Distância arranjo → inversor (m)', tipo: 'number' },
    { p: 'geracao.distanciaInversorQuadroM', l: 'Distância inversor → quadro (m)', tipo: 'number' },
  ] },
  { titulo: 'Telhado (da vistoria)', fechada: true, campos: [
    { p: 'telhado.tipoTelha', l: 'Tipo de telha' },
    { p: 'telhado.estrutura', l: 'Estrutura de suporte' },
    { p: 'telhado.estruturaTelhado', l: 'Estrutura do telhado' },
    { p: 'telhado.distanciaVigas', l: 'Distância entre vigas/caibros' },
    { p: 'telhado.quedas', l: 'Nº de quedas' },
    { p: 'telhado.geometria', l: 'Geometria' },
    { p: 'telhado.dimensoes', l: 'Dimensões' },
    { p: 'telhado.acessibilidade', l: 'Acessibilidade' },
    { p: 'telhado.condulete', l: 'Precisa de condulete', tipo: 'check' },
    { p: 'telhado.observacoes', l: 'Observações do telhado', largo: true },
  ] },
  { titulo: 'Responsável técnico', campos: [
    { p: 'responsavel.nome', l: 'Nome' },
    { p: 'responsavel.titulo', l: 'Título profissional' },
    { p: 'responsavel.registro', l: 'Registro CREA/CFT' },
    { p: 'responsavel.art', l: 'Nº ART/TRT' },
  ] },
  { titulo: 'Observações do projeto', campos: [
    { p: 'observacoes', l: 'Aparecem no memorial e nas notas do unifilar', tipo: 'textarea', largo: true },
  ] },
];

const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; };
const conc = () => estado.config.concessionarias.find((c) => c.id === estado.dados?.concessionaria) || null;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, casas = 2) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: casas }) : '–');

// ---------- navegação ----------
function irPara(n) {
  [1, 2, 3].forEach((i) => $(`#passo${i}`).classList.toggle('oculto', i !== n));
  $$('.passos li').forEach((li) => li.classList.toggle('ativo', Number(li.dataset.passo) === n));
  $('#salvarJson').disabled = !estado.dados;
  window.scrollTo({ top: 0 });
}

// ---------- formulário ----------
function renderForm() {
  const f = $('#form');
  const legenda = `<div class="legenda-cores"><span><span class="tag lido">vistoria</span> lido do documento</span><span><span class="tag sugerido">norma</span> sugerido pela norma/cálculo – confira</span></div>`;
  f.innerHTML = legenda + SECOES.map((s) => `
    <fieldset${s.fechada ? ' class="fechada"' : ''}><legend>${s.titulo}</legend><div class="campos">
      ${s.campos.map(renderCampo).join('')}
    </div></fieldset>`).join('');
}

function renderCampo(c) {
  const v = get(estado.dados, c.p);
  const cls = ['campo', c.largo ? 'largo' : '', c.tipo === 'check' ? 'check' : '', estado.lidos.has(c.p) ? 'lido' : '', estado.sugeridos.has(c.p) ? 'sugerido' : ''].filter(Boolean).join(' ');
  const tag = estado.lidos.has(c.p) ? '<span class="tag lido">vistoria</span>' : estado.sugeridos.has(c.p) ? '<span class="tag sugerido">norma</span>' : '';
  const id = 'f_' + c.p.replace(/\./g, '_');
  let input;
  if (c.tipo === 'select') {
    input = `<select id="${id}" data-p="${c.p}">${c.opcoes().map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(v ?? '') ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
  } else if (c.tipo === 'check') {
    return `<div class="${cls}" data-campo="${c.p}"><input type="checkbox" id="${id}" data-p="${c.p}"${v ? ' checked' : ''}><label for="${id}">${c.l} ${tag}</label></div>`;
  } else if (c.tipo === 'textarea') {
    input = `<textarea id="${id}" data-p="${c.p}">${esc(v)}</textarea>`;
  } else {
    input = `<input id="${id}" data-p="${c.p}" ${c.tipo === 'number' ? 'inputmode="decimal"' : ''} value="${esc(v)}">`;
  }
  return `<div class="${cls}" data-campo="${c.p}"><label for="${id}">${c.l} ${tag}</label>${input}</div>`;
}

function aoEditar(ev) {
  const el = ev.target;
  const p = el.dataset.p;
  if (!p) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  const def = SECOES.flatMap((s) => s.campos).find((c) => c.p === p);
  if (def?.tipo === 'number' && v !== '') { const nv = Number(String(v).replace(',', '.')); v = Number.isFinite(nv) ? nv : v; }
  set(estado.dados, p, v);
  estado.lidos.delete(p); estado.sugeridos.delete(p);
  $(`[data-campo="${p}"]`)?.classList.remove('lido', 'sugerido');

  // Regras dependentes
  if (p === 'entrada.categoria') {
    const k = conc()?.categorias.find((x) => x.codigo === v);
    if (k) {
      Object.assign(estado.dados.entrada, { disjuntorGeralA: k.disjuntorA, bitolaFaseMm2: k.bitolaMm2, bitolaNeutroMm2: k.bitolaMm2, medicao: k.medicao, fases: k.fases, tensao: k.tensao });
      ['entrada.disjuntorGeralA', 'entrada.bitolaFaseMm2', 'entrada.bitolaNeutroMm2', 'entrada.medicao'].forEach((x) => estado.sugeridos.add(x));
    }
  }
  if (p === 'concessionaria') {
    const c = conc();
    estado.dados.distribuidora = c ? c.distribuidoras[0] : '';
    if (c && !c.tensoes.includes(estado.dados.entrada.tensao)) estado.dados.entrada.tensao = c.tensoes[0];
    if (c && !c.categorias.some((k) => k.codigo === estado.dados.entrada.categoria)) estado.dados.entrada.categoria = '';
  }
  if (['concessionaria', 'entrada.categoria', 'entrada.fases', 'entrada.tensao'].includes(p)) {
    const foco = document.activeElement?.id;
    renderForm();
    if (foco) document.getElementById(foco)?.focus();
  }
  if (!estado.materiaisEditados && /^(geracao|telhado|entrada\.adequacaoPadrao)/.test(p)) estado.atualizarMateriais = true;
  agendarRevisao();
}

let timer;
function agendarRevisao() { clearTimeout(timer); timer = setTimeout(revisar, 350); }

async function revisar() {
  const r = await api('/api/revisar', { dados: estado.dados });
  if (!r) return;
  if (estado.atualizarMateriais && !estado.materiaisEditados) { estado.dados.materiais = r.materiaisPadrao; renderMateriais(); }
  estado.atualizarMateriais = false;
  mostrarRevisao(r);
}

function mostrarRevisao(r) {
  $('#preview').innerHTML = r.svg;
  const c = r.calculo;
  const linhas = [
    ['Potência dos módulos', `${fmt(c.potenciaPicoKwp)} kWp`],
    ['Potência dos inversores', `${fmt(c.potenciaInversoresKw)} kW`],
    ['Potência da microgeração', `${fmt(c.potenciaMicrogeracaoKw)} kW`],
    ['Corrente do inversor', `${fmt(c.correnteInversorA, 1)} A`],
    ['Disjuntor sugerido', c.disjuntorInversorSugeridoA ? `${c.disjuntorInversorSugeridoA} A` : '–'],
    ['Cabo CA sugerido', c.caboCASugeridoMm2 ? `${c.caboCASugeridoMm2} mm²` : '–'],
    ['Medição', c.medicao === 'indireta' ? 'Indireta' : 'Direta'],
  ];
  if (Number.isFinite(c.limiteMicrogeradorKw)) linhas.push(['Limite da categoria', `${c.limiteMicrogeradorKw} kW (${c.conexaoInversor})`]);
  $('#resumo').innerHTML = linhas.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $$('.campo.erro').forEach((el) => el.classList.remove('erro'));
  const v = r.validacao;
  $('#validacao').innerHTML = v.length
    ? v.map((m) => `<li class="${m.nivel}" data-alvo="${m.campo}">${m.nivel === 'erro' ? '✖' : '!'} ${esc(m.msg)}</li>`).join('')
    : '<li class="ok">✔ Nenhuma pendência. Pode gerar os documentos.</li>';
  v.filter((m) => m.nivel === 'erro').forEach((m) => $(`[data-campo="${m.campo}"]`)?.classList.add('erro'));
  estado.validacao = v;
}

// ---------- materiais ----------
function renderMateriais() {
  const itens = estado.dados.materiais || [];
  $('#tbMateriais').innerHTML = itens.map((it, i) => `
    <tr data-i="${i}">
      <td>${i + 1}</td>
      <td><input data-m="grupo" value="${esc(it.grupo)}"></td>
      <td><input data-m="descricao" value="${esc(it.descricao)}"></td>
      <td><input data-m="unidade" value="${esc(it.unidade)}"></td>
      <td><input data-m="quantidade" inputmode="decimal" value="${esc(it.quantidade)}"></td>
      <td><button class="remover" title="Remover" data-remover="${i}">×</button></td>
    </tr>`).join('');
}

$('#tbMateriais').addEventListener('input', (ev) => {
  const tr = ev.target.closest('tr'); const campo = ev.target.dataset.m;
  if (!tr || !campo) return;
  let v = ev.target.value;
  if (campo === 'quantidade') { const n = Number(v.replace(',', '.')); if (Number.isFinite(n) && v !== '') v = n; }
  estado.dados.materiais[Number(tr.dataset.i)][campo] = v;
  estado.materiaisEditados = true;
});
$('#tbMateriais').addEventListener('click', (ev) => {
  const i = ev.target.dataset.remover;
  if (i === undefined) return;
  estado.dados.materiais.splice(Number(i), 1);
  estado.materiaisEditados = true;
  renderMateriais();
});
$('#addItem').addEventListener('click', () => {
  (estado.dados.materiais ||= []).push({ grupo: '', descricao: '', unidade: 'un', quantidade: 1 });
  estado.materiaisEditados = true;
  renderMateriais();
  $$('#tbMateriais tr').at(-1)?.querySelector('[data-m="descricao"]')?.focus();
});
$('#recalcMateriais').addEventListener('click', async () => {
  if (estado.materiaisEditados && !confirm('Refazer a lista descarta as edições feitas na tabela. Continuar?')) return;
  const r = await api('/api/revisar', { dados: estado.dados });
  if (!r) return;
  estado.dados.materiais = r.materiaisPadrao;
  estado.materiaisEditados = false;
  renderMateriais();
});

// ---------- API ----------
async function api(url, corpo) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.erro || res.statusText);
    return j;
  } catch (err) {
    alert(`Erro: ${err.message}`);
    return null;
  }
}

function abrirRevisao(r, avisos = [], metodo = '') {
  estado.dados = r.dados;
  estado.lidos = new Set(r.campos || []);
  estado.sugeridos = new Set(r.sugeridos || []);
  estado.materiaisEditados = false;
  const nLidos = estado.lidos.size;
  const info = metodo === 'claude' ? `Leitura feita com IA (${estado.config.modelo}).` : metodo === 'texto' ? 'Leitura pelo texto do arquivo.' : '';
  const blocos = [];
  if (metodo) blocos.push(`<div class="avisos info"><strong>${nLidos} campo(s) lidos da vistoria.</strong> ${info} Confira os campos em verde, revise os sugeridos em amarelo e complete o que a vistoria não traz (bitolas, modelos de módulo e inversor, registro INMETRO, responsável técnico).</div>`);
  if (avisos.length) blocos.push(`<div class="avisos"><strong>Atenção na leitura:</strong><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`);
  $('#avisosLeitura').innerHTML = blocos.join('');
  renderForm();
  renderMateriais();
  mostrarRevisao(r);
  irPara(2);
}

// ---------- passo 1: upload ----------
async function enviarArquivo(arquivo) {
  if (!arquivo) return;
  const zona = $('#zona');
  zona.classList.add('carregando');
  $('#statusLeitura').textContent = `Lendo "${arquivo.name}"…${estado.config.leituraIA ? ' (a leitura com IA pode levar até um minuto)' : ''}`;
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  try {
    const res = await fetch('/api/extrair', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) throw new Error(j.erro || res.statusText);
    $('#statusLeitura').textContent = '';
    abrirRevisao(j, j.avisos, j.metodo);
  } catch (err) {
    $('#statusLeitura').textContent = `Erro: ${err.message}`;
  } finally {
    zona.classList.remove('carregando');
    $('#arquivo').value = '';
  }
}

$('#arquivo').addEventListener('change', (e) => enviarArquivo(e.target.files[0]));
const zona = $('#zona');
['dragenter', 'dragover'].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.add('sobre'); }));
['dragleave', 'drop'].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.remove('sobre'); }));
zona.addEventListener('drop', (e) => enviarArquivo(e.dataTransfer.files[0]));

$('#semArquivo').addEventListener('click', async () => {
  const r = await api('/api/completar', { dados: estado.config.projetoVazio });
  if (r) abrirRevisao({ ...r, dados: { ...r.dados, materiais: r.materiaisPadrao } });
});

// ---------- salvar / abrir ----------
$('#salvarJson').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(estado.dados, null, 2)], { type: 'application/json' });
  baixar(blob, `${(estado.dados.cliente.nome || 'projeto').replace(/[^\wÀ-ú]+/g, '-')}-dados.json`);
});
$('#abrirJson').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const dados = JSON.parse(await f.text());
    const r = await api('/api/revisar', { dados });
    if (r) { abrirRevisao({ ...r, dados: { ...estado.config.projetoVazio, ...dados, materiais: dados.materiais || r.materiaisPadrao } }); estado.materiaisEditados = Boolean(dados.materiais); }
  } catch (err) { alert('Arquivo inválido: ' + err.message); }
  e.target.value = '';
});

// ---------- passo 2 / 3 ----------
$('#form').addEventListener('input', aoEditar);
$('#form').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') aoEditar(e); });
$('#validacao').addEventListener('click', (e) => {
  const alvo = e.target.closest('li')?.dataset.alvo;
  const el = alvo && $(`[data-campo="${alvo}"] [data-p]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
});
$('#preview').addEventListener('click', () => $('#preview').classList.toggle('zoom'));
$('#voltar1').addEventListener('click', () => irPara(1));
$('#voltar2').addEventListener('click', () => irPara(2));
$('#novo').addEventListener('click', () => { if (confirm('Começar um novo projeto? Os dados atuais serão descartados (salve o .json antes, se quiser).')) { estado.dados = null; irPara(1); } });
$('#irGerar').addEventListener('click', async () => {
  await revisar();
  const erros = (estado.validacao || []).filter((m) => m.nivel === 'erro');
  $('#pendenciasGerar').innerHTML = erros.length
    ? `<div class="avisos"><strong>Ainda há ${erros.length} pendência(s).</strong> Você pode gerar mesmo assim (os documentos sairão com campos em branco) ou voltar e corrigir:<ul>${erros.map((m) => `<li>${esc(m.msg)}</li>`).join('')}</ul></div>`
    : '';
  irPara(3);
});

$$('[data-gerar]').forEach((b) => b.addEventListener('click', async () => {
  const tipo = b.dataset.gerar;
  b.disabled = true;
  try {
    const res = await fetch(`/api/gerar/${tipo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados: estado.dados, ignorarErros: true }) });
    if (!res.ok) throw new Error((await res.json()).erro);
    const nome = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `${tipo}`;
    baixar(await res.blob(), nome);
  } catch (err) { alert('Erro ao gerar: ' + err.message); } finally { b.disabled = false; }
}));

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- início ----------
estado.config = await (await fetch('/api/config')).json();
if (!estado.config.leituraIA) {
  $('#statusLeitura').textContent = 'Leitura de vistoria preenchida no computador (PDF/Word). Para vistorias escaneadas ou escritas à mão, configure a chave ANTHROPIC_API_KEY no servidor.';
}
