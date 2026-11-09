import express from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LISTA_CONCESSIONARIAS } from './src/concessionarias.js';
import { lerVistoria, claudeDisponivel, MODELO_CLAUDE } from './src/extracao.js';
import { completar, calcular, validar, gerarMateriais, mesclar, projetoVazio } from './src/projeto.js';
import { desenharUnifilar } from './src/unifilar.js';
import { gerarMemorial } from './src/memorial.js';
import { gerarPlanilhaMateriais } from './src/materiais.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const nomeArquivo = (dados, sufixo, ext) => {
  const base = String(dados?.cliente?.nome || 'projeto')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'projeto';
  return `${base}-${sufixo}.${ext}`;
};

function revisao(dados) {
  const d = mesclar(projetoVazio(), dados);
  return {
    calculo: calcular(d),
    validacao: validar(d),
    materiaisPadrao: gerarMateriais(d),
    svg: desenharUnifilar(d).toSVG(),
  };
}

app.get('/api/config', (_req, res) => {
  res.json({ concessionarias: LISTA_CONCESSIONARIAS, leituraIA: claudeDisponivel(), modelo: claudeDisponivel() ? MODELO_CLAUDE : null, projetoVazio: projetoVazio() });
});

app.post('/api/extrair', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Envie o arquivo da vistoria.' });
    const lido = await lerVistoria(req.file.buffer, req.file.mimetype, req.file.originalname);
    const { dados, sugeridos } = completar(lido.dados);
    dados.materiais = gerarMateriais(dados);
    res.json({ dados, campos: lido.campos, sugeridos, avisos: lido.avisos || [], metodo: lido.metodo, ...revisao(dados) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: `Não foi possível ler o arquivo: ${err.message}` });
  }
});

app.post('/api/completar', (req, res) => {
  const { dados, sugeridos } = completar(req.body?.dados || {});
  res.json({ dados, sugeridos, ...revisao(dados) });
});

app.post('/api/revisar', (req, res) => {
  res.json(revisao(req.body?.dados || {}));
});

async function gerar(tipo, dados) {
  switch (tipo) {
    case 'memorial': return { buf: await gerarMemorial(dados), nome: nomeArquivo(dados, 'memorial-descritivo', 'docx'), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    case 'materiais': return { buf: await gerarPlanilhaMateriais(dados), nome: nomeArquivo(dados, 'tabela-de-materiais', 'xlsx'), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    case 'unifilar': return { buf: desenharUnifilar(dados).toDXF(), nome: nomeArquivo(dados, 'diagrama-unifilar', 'dxf'), mime: 'application/dxf' };
    case 'unifilar-svg': return { buf: Buffer.from(desenharUnifilar(dados).toSVG()), nome: nomeArquivo(dados, 'diagrama-unifilar', 'svg'), mime: 'image/svg+xml' };
    case 'pacote': {
      const zip = new JSZip();
      for (const t of ['memorial', 'materiais', 'unifilar', 'unifilar-svg']) {
        const r = await gerar(t, dados);
        zip.file(r.nome, r.buf);
      }
      zip.file(nomeArquivo(dados, 'dados', 'json'), JSON.stringify(dados, null, 2));
      return { buf: await zip.generateAsync({ type: 'nodebuffer' }), nome: nomeArquivo(dados, 'projeto', 'zip'), mime: 'application/zip' };
    }
    default: return null;
  }
}

app.post('/api/gerar/:tipo', async (req, res) => {
  try {
    const dados = mesclar(projetoVazio(), req.body?.dados || {});
    const erros = validar(dados).filter((m) => m.nivel === 'erro');
    if (erros.length && !req.body?.ignorarErros) {
      return res.status(422).json({ erro: 'Há pendências no projeto.', validacao: erros });
    }
    const r = await gerar(req.params.tipo, dados);
    if (!r) return res.status(404).json({ erro: 'Tipo de documento desconhecido.' });
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${r.nome}"`);
    res.send(r.buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: `Falha ao gerar: ${err.message}` });
  }
});

export default app;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.PORT) || 3000;
  app.listen(porta, () => {
    console.log(`Gerador Solarmar em http://localhost:${porta}`);
    console.log(claudeDisponivel() ? `Leitura com IA ativa (${MODELO_CLAUDE}).` : 'Leitura com IA desativada (defina ANTHROPIC_API_KEY para ler vistorias escaneadas/manuscritas).');
  });
}
