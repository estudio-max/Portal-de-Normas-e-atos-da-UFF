# Arquitetura — Portal de Normas e Atos da UFF

Documento de referência da arquitetura para **escala de produção** (anos de
boletins, legado completo, dezenas de milhares de atos). Pensado para ser
**portável** (não depende da HostGator) e **migrável** para qualquer servidor
LAMP/LEMP. Para o passo a passo de migração, ver [MIGRACAO.md](MIGRACAO.md).

---

## 1. Princípios de projeto

1. **Separação de responsabilidades** — extração (ler PDF) ≠ armazenamento
   (banco) ≠ entrega (API) ≠ apresentação (site). Cada camada pode ser trocada
   ou movida sem reescrever as outras.
2. **Incremental e idempotente** — cada boletim é processado **uma vez**.
   Reprocessar não duplica nada (chaves estáveis + *upsert*). Isso é o que torna
   viável indexar **anos** de legado sem refazer tudo todo dia.
3. **Gentil com a origem** — downloads do site da UFF sempre sequenciais, com
   pausa; o legado é puxado aos poucos (*backfill* paginado), nunca em rajada.
4. **Portabilidade** — MySQL/MariaDB padrão + PHP/PDO padrão. Sem recursos
   proprietários da hospedagem. Banco recriável por um `schema.sql`. Credenciais
   isoladas em `config.php` (fora do versionamento).
5. **Servidor faz o trabalho pesado** — busca, filtro e paginação rodam no
   MySQL; o navegador recebe só a página atual (≈50 atos), não a base inteira.

---

## 2. Visão geral (camadas)

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 1. EXTRAÇÃO (Python)   — roda na nuvem (GitHub Actions) ou em qualquer │
 │    máquina. Lê os PDFs do Boletim da UFF (gentil), identifica atos,    │
 │    relações, SEI, SIAPEs e corpo. Saída: JSON por boletim.            │
 └───────────────┬──────────────────────────────────────────────────────┘
                 │  publica os JSON (fonte da verdade, versionada no GitHub)
                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 2. IMPORTADOR (PHP CLI)  — roda no servidor (cron). Lê os JSON e faz   │
 │    UPSERT no MySQL. Incremental: só processa o que mudou.             │
 └───────────────┬──────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 3. BANCO (MySQL/MariaDB) — fonte consultável. Tabelas normalizadas +  │
 │    índices + FULLTEXT para busca por nome no corpo. Veja db/schema.sql │
 └───────────────┬──────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 4. API (PHP/PDO)  — REST somente-leitura. Lista paginada, filtros,    │
 │    busca por nome/SIAPE, ficha de um ato, estatísticas.              │
 └───────────────┬──────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 5. SITE (React, estático)  — consome a API. Carrega leve (só a página │
 │    atual). Mesmo visual atual, sem baixar a base inteira.            │
 └──────────────────────────────────────────────────────────────────────┘
```

**Por que a extração continua fora do banco?** Assim ela pode rodar na nuvem
(sem expor o MySQL à internet) e o resultado (JSON) é auditável, versionado e
re-importável em qualquer banco. O banco nunca precisa aceitar conexão remota.

---

## 3. Fluxo de dados

### Dia a dia (incremental)
1. GitHub Actions roda a extração → gera/atualiza os JSON dos boletins **novos**.
2. Publica no repositório (GitHub).
3. Cron na HostGator (1×/dia) chama `importar.php` → baixa os JSON → *upsert* no MySQL.
4. O site consulta a API → sempre atualizado, sem recarregar tudo.

### Backfill do legado (anos anteriores)
- Um processo à parte percorre os boletins antigos **aos poucos** (ex.: N por
  execução, com pausa), gera os JSON e o importador os carrega. O site cresce
  sem impacto de performance (a API pagina) e sem sobrecarregar a UFF.

---

## 4. Modelo de dados (resumo — detalhe em `db/schema.sql`)

| Tabela | Papel |
|---|---|
| `boletins` | 1 linha por boletim (número, ano, data, arquivo, URL do PDF) |
| `atos` | 1 linha por ato (tipo, órgão, número, ano, data, ementa, status, SEI…) |
| `ato_corpo` | corpo do ato (texto longo) com **FULLTEXT** — busca por nome |
| `ato_siapes` | matrículas SIAPE citadas (indexado) — busca por SIAPE |
| `ato_relacoes` | relações (altera/revoga/…) com o ato de destino |
| `ato_tags` | marcadores/palavras-chave |

**Chave do ato (estável):** `{arquivo}-{tipo}-{sigla}-{numero}-{ano}` (slug). É
determinística → reimportar atualiza a mesma linha (idempotente), nunca duplica.

**Vigência (status):** calculada na importação a partir do índice reverso
(quem revoga/altera quem) e gravada em `atos.status` para consulta rápida.

---

## 5. API (contrato resumido — ver `api/`)

Base: `https://uff.fanara.com.br/api/`

| Endpoint | Retorna |
|---|---|
| `GET /atos` | lista paginada (filtros: `busca,tipo,orgao,ano,status,nome,siape,com_relacoes,com_sei,pagina,por_pagina,ordenar,dir`) |
| `GET /atos/{id}` | ficha completa (ementa, relações, referenciado-por, SIAPEs, links SEI) |
| `GET /stats` | totais (atos, vigentes, revogados, alterados, órgãos, com SEI, boletins) |
| `GET /filtros` | listas distintas (tipos, órgãos, anos) para os menus |

Respostas em JSON, UTF-8, com CORS liberado (uso interno). Sem escrita pela API
(a curadoria é feita por importação/admin) → superfície de ataque mínima.

---

## 6. Escalabilidade

- **Paginação obrigatória** na API (nunca devolve tudo). O navegador recebe ~50
  atos por vez, independentemente de a base ter 3 mil ou 300 mil.
- **Índices** em `tipo, orgao, ano, status, boletim_id` e **FULLTEXT** no corpo
  → filtros e busca por nome continuam rápidos no legado inteiro.
- **Corpo separado** (`ato_corpo`) → as listagens não carregam o texto pesado.
- **Importação incremental** → custo de manutenção constante (só o que mudou).

---

## 7. Segurança

- Credenciais do banco **somente** em `config.php` no servidor, **fora do Git**
  (o repositório é público). Versionamos apenas `config.example.php`.
- MySQL acessado por **`localhost`** (a hospedagem não expõe o banco à internet).
- API é **somente-leitura**; consultas via **PDO com *prepared statements***
  (sem SQL injection).
- Dados são informação **pública** (Boletim de Serviço) — sem dado sigiloso.

---

## 8. Portabilidade / troca de servidor

Tudo foi pensado para mudar de hospedagem sem reescrever nada:
- Banco recriado por `db/schema.sql` em qualquer MySQL 5.7+/MariaDB 10.2+.
- API e importador são **PHP 7.4+/8 puro com PDO** — rodam em qualquer LAMP.
- Só um arquivo muda entre servidores: `config.php` (credenciais + caminhos).
- Passo a passo completo em [MIGRACAO.md](MIGRACAO.md).

---

## 9. Roadmap de implantação

1. **Fase 1 — Fundação (este documento + `schema.sql` + API + importador).**
2. **Fase 2 — Implantar:** criar tabelas, subir a API, configurar `config.php`,
   rodar o importador (carga inicial dos 56 boletins de 2026).
3. **Fase 3 — Front-end:** apontar o site para a API (paginação server-side).
4. **Fase 4 — Backfill do legado:** indexar anos anteriores, aos poucos.
5. **Fase 5 — Admin (opcional):** tela autenticada para curadoria manual.
