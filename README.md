# Gerador de Projeto Solarmar

App web que recebe a **vistoria técnica Solarmar** e entrega, para revisão da equipe técnica:

1. **Memorial descritivo** (Word .docx, editável)
2. **Tabela de materiais** (Excel .xlsx)
3. **Diagrama unifilar** (DXF, abre no AutoCAD; salve como DWG) — conforme a concessionária

## Como usar

```bash
npm install
npm start            # http://localhost:3000
```

Fluxo da página:

1. **Vistoria** – arraste o PDF/Word da vistoria (ou uma foto, com a leitura por IA ativa). Também dá para preencher sem arquivo.
2. **Revisão dos dados** – os campos lidos da vistoria aparecem em verde; os sugeridos pela norma (categoria, bitola, disjuntor e cabo do inversor) em amarelo. A lateral mostra as pendências (regras da concessionária), o resumo de potências e a pré-visualização do unifilar, atualizada a cada alteração. A tabela de materiais é editável.
3. **Documentos** – baixe cada arquivo ou o pacote .zip (inclui os dados em .json para reabrir o projeto depois).

### Leitura de vistorias escaneadas ou escritas à mão

Sem configuração, o app lê o texto de vistorias preenchidas no computador (PDF ou Word, modelo Solarmar).
Para ler vistorias escaneadas, fotografadas ou manuscritas, defina a chave da API da Anthropic antes de iniciar:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

O modelo usado é `claude-opus-5-5` (troque com `CLAUDE_MODEL`). Em qualquer caso os dados passam pela tela de revisão antes de gerar os documentos.

## O que a vistoria não traz

A vistoria atual não tem: concessionária, bitola dos cabos de entrada, categoria/caixa do padrão, modelo e registro INMETRO de módulos e inversor, responsável técnico. Esses campos são completados na tela de revisão (bitola e categoria são sugeridas pela tabela da norma).

## Regras por concessionária (`src/concessionarias.js`)

| Concessionária | Tabela de categorias | Situação |
|---|---|---|
| CPFL | GED 13 v2.25, Tabelas 1A e 1B; limites do Anexo H do GED 15303 v13.0 | Conferida |
| Enel | CNC-OMBR-MAT-24-1569, Anexo A (127/220 V) | Bitolas a conferir |
| EDP | PT.DT.PDN.00061 v12 (EDP **Espírito Santo**) | Conferir versão de SP |
| Neoenergia Elektro | DIS-NOR-030 rev05, Tabela 3 | Bitolas a conferir |

Validações automáticas: medição indireta acima do limite de medição direta, neutro obrigatório, limite de potência do microgerador por categoria (CPFL, Anexo H), declaração do fabricante para inversor acima de 10 kW (CPFL), caixa polifásica para monofásico (Elektro), disjuntor do inversor menor que a corrente nominal, cabo CA não protegido pelo disjuntor, relação CC/CA e limite de 75 kW.

## Unifilar

Prancha A3 com: rede da distribuidora e ponto de conexão, ramal de entrada (nº de condutores e seção), padrão de entrada (chave seccionadora + TCs quando a medição é indireta), medidor bidirecional, disjuntor geral, DPS, QDG e demais cargas, disjuntor e DPS do sistema gerador, inversor, string box, arranjo fotovoltaico, aterramento, quadro resumo, legenda, notas da concessionária e carimbo Solarmar. Layers: `CONCESSIONARIA`, `EXISTENTE`, `PROJETADO`, `CC`, `ATERRAMENTO`, `TEXTO`, `CARIMBO`.

O arquivo é DXF R12 (texto em ANSI 1252). Para entregar em DWG, abra no AutoCAD e use *Salvar como → DWG*.

## Testes

```bash
npm test
```

`exemplos/vistoria-exemplo-preenchida.pdf` é uma vistoria fictícia no modelo Solarmar usada nos testes.
