# Portal de Normas e Atos da UFF

Indexa o Boletim de Serviço da UFF: baixa os PDFs, extrai os atos, carrega num
MySQL e serve um portal de busca e análise.

No ar em **https://inteligencia.fanara.com.br/**

## Comece por aqui

**[`CLAUDE.md`](CLAUDE.md) descreve o estado atual do projeto** — o que está no
ar, qual arquivo é o vivo, como fazer deploy e quais são as pendências. Leia
antes de mexer em qualquer coisa.

- Arquitetura da base: [`docs/ARQUITETURA-BASE-DADOS.md`](docs/ARQUITETURA-BASE-DADOS.md)
- Histórico: `git log` e [`docs/`](docs/)

## Rodar local

```bash
npm install
npm run dev
```

O build de produção (`npm run build`) gera `dist/`, que sobe manualmente para a
HostGator — ver o procedimento em [`CLAUDE.md`](CLAUDE.md).
