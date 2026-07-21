# Portal de Normas e Atos da UFF

Indexa o Boletim de Serviço da UFF: baixa os PDFs, extrai os atos, carrega num
MySQL e serve um portal de busca e análise.

No ar em **https://inteligencia.fanara.com.br/**

## Como o sistema é feito

Três linguagens, cada uma numa etapa diferente do caminho que leva um PDF até
uma busca. A barra de linguagens do GitHub mostra as proporções, mas não diz o
que cada uma faz — é isto:

| Etapa | Tecnologia | Onde no repositório |
|---|---|---|
| Baixar e ler os PDFs do Boletim | **Python** (PyMuPDF; Tesseract no OCR de 2001) | [`tools/`](tools/) |
| Guardar os atos | **MySQL** 8, InnoDB, utf8mb4, schema normalizado | [`backend/db/`](backend/db/) |
| Servir as consultas | **PHP** 8.3, arquivo único, sem framework | [`backend/api/`](backend/api/) |
| Interface | **React + TypeScript**, build com Vite | [`src/`](src/) |
| Rodar tudo todo dia | **GitHub Actions** | [`.github/workflows/`](.github/workflows/) |

O peso das linguagens engana: o TypeScript é a maior fatia em linhas, mas a
parte difícil do projeto está no Python. Extrair atos de um PDF sem estrutura,
num formato que mudou várias vezes em 25 anos, é o problema central — veja
[`docs/REGEX.md`](docs/REGEX.md).

## Comece por aqui

**[`CLAUDE.md`](CLAUDE.md) descreve o estado atual do projeto** — o que está no
ar, qual arquivo é o vivo, como fazer deploy e quais são as pendências. Leia
antes de mexer em qualquer coisa.

## Documentação

| Documento | Para quê |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Comece aqui.** O estado atual: o que está no ar, qual arquivo é o vivo, como fazer deploy, quais são as pendências e as armadilhas que já custaram retrabalho. |
| [`docs/ARQUITETURA-C4.md`](docs/ARQUITETURA-C4.md) | A forma do sistema em quatro níveis de zoom, com diagramas. Por onde entrar se você nunca viu o projeto. |
| [`docs/ARQUITETURA-BASE-DADOS.md`](docs/ARQUITETURA-BASE-DADOS.md) | Por que o banco é modelado assim (estrela, PK substituta, tabelas-fato). |
| [`docs/REGEX.md`](docs/REGEX.md) | Os 55 padrões que transformam PDF em registro, um a um, com o que cada um reconhece e por quê. Gerado do código. |
| [`docs/GUIA-EXTRACAO-BS.md`](docs/GUIA-EXTRACAO-BS.md) | O corpus: como o formato do boletim mudou em 25 anos e cada armadilha que isso criou. |
| [`docs/MIGRACAO-UFF.md`](docs/MIGRACAO-UFF.md) | Runbook do cutover para o domínio oficial da UFF. |
| [`docs/PROMPTS-DOCUMENTACAO-VISUAL.md`](docs/PROMPTS-DOCUMENTACAO-VISUAL.md) | Como explicar o portal a quem não é de TI: figuras, mapas e diagramas. |

Histórico do projeto: `git log`.

## Rodar local

```bash
npm install
npm run dev
```

O build de produção (`npm run build`) gera `dist/`, que sobe manualmente para a
HostGator — ver o procedimento em [`CLAUDE.md`](CLAUDE.md).
