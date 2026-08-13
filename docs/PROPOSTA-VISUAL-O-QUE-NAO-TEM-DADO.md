# Proposta visual 2026: as telas que a base não sustenta

Documento de devolução para quem desenhou a proposta visual de agosto/2026.

A proposta chegou em três levas, somando **onze telas**. Oito foram
implementadas em 13/08/2026 (ver a seção final). **Três não foram**, e este
arquivo diz por quê — com a consulta que qualquer pessoa pode repetir para
conferir.

O critério não é dificuldade de implementação. É que **a tela afirmaria coisas
que o Boletim de Serviço não publica**. Num portal de normas, interface que
afirma demais é o defeito mais caro que existe: ela não parece errada, e é por
isso que contamina tudo à volta. É a mesma regra que já governa
[`METODOLOGIA-ODS.md`](METODOLOGIA-ODS.md) ("sem cluster, o ato NÃO recebe
rótulo"), [`METODOLOGIA-POLITICAS.md`](METODOLOGIA-POLITICAS.md) ("sem evidência
localizada no Boletim", nunca "não houve") e a aba Mudanças ("nenhum texto é
gerado").

---

## 1. Detalhe da comissão — o bloco "Membros"

**O mockup mostra:** uma lista de quatro pessoas com nome, matrícula SIAPE e
papel (Presidente, Vice-presidente, Membro), cada uma marcada como Titular ou
Suplente.

**O que existe:** nada disso. A rota devolve o colegiado, os atos que o citam,
o mandato e o estado documental:

```
GET /api/comissoes?corpo=<slug>
→ corpo{slug,sigla,nome,tipo,obrig}, atos[], ultimaData, eventos{m12,m24,m36},
  mandatos[], estado, janela, avisos[]
```

Não há `membros`, e não é omissão da rota: **o dado não está no banco.** O
`CLAUDE.md` registra isso como pendência declarada da Fase 2 do Dossiê —
"`colegiado` como entidade + membros com papel (presidente/titular/suplente)
extraídos do **dispositivo**"; hoje "o `ato_funcao` vem vazio nos atos de
comissão e o papel está só em prosa".

**Por que não é só extrair:** o papel costuma vir por anáfora — *"sob a
presidência do primeiro"* —, que depende da ordem dos nomes no texto. E
`ato_pessoa` é **menção, não participação**: numa banca, o avaliado também é
citado. Preencher a tela com quem o ato menciona produziria uma lista de
membros que inclui gente que não é membro.

**O que foi feito:** a tela de comissões existe com o que a base sustenta.
O bloco de membros não foi desenhado como "vazio" nem como "em breve" — ele
simplesmente não está lá, porque prometer um bloco que nunca enche é pior que
não tê-lo.

**O que destravaria:** a Fase 2 do Dossiê. Pré-requisito dela, também no
`CLAUDE.md`: consertar o `signatario` (~10–13% vazio ou capturado errado) e o
merge curado das 1.462 pessoas fragmentadas por zero à esquerda.

---

## 2. Resultados da busca com abas Atos / Pessoas / Comissões / Processos

**O mockup mostra:** uma tela de resultados com quatro categorias contadas
("Atos (8), Pessoas (5), Comissões (6), Processos (5)"), cada resultado com
tipo textual, trecho destacado e ação própria. Mais um painel "Buscas
recentes".

**O que existe:** busca **sobre atos**, só. Pessoa e processo são *filtros* que
estreitam a lista de atos (`/api/atos?nome=`, `?siape=`, `?processo=`), não
entidades pesquisáveis com página própria. Comissão é outra rota, com outro
formato. Não há endpoint que devolva resultados heterogêneos numa lista só, nem
contagem por categoria.

**O agravante:** o cartão "Pessoa" do mockup diz *"Membro da Comissão de Ética
no Uso de Inteligência Artificial da UFF desde 15/04/2024"*. É o mesmo dado
inexistente do item 1, agora na tela de maior tráfego do portal.

**Duas armadilhas conhecidas que essa tela pisaria:**

- **Pessoa sem SIAPE não existe como entidade.** Só 30–70% dos atos registram
  matrícula (34% em 2001, ~65% em 2025), e o extrator só cria `pessoa` quando
  acha uma. Uma aba "Pessoas" com contagem daria a impressão de listar os
  servidores citados no acervo — quando lista, no máximo, os que tinham
  matrícula no texto.
- **Um SIAPE pode carregar duas pessoas** e uma pessoa pode estar partida em
  duas linhas pelo zero à esquerda (1.462 casos medidos). Uma aba "Pessoas"
  exibiria essas duplicatas como pessoas distintas, com nome.

**O que destravaria:** uma rota de busca federada com contrato próprio, e o
merge curado de pessoas antes dela. Não é trabalho de frontend.

---

## 3. Mapa de relações com arestas "institui / designa / vinculado a / referente a"

**O mockup mostra:** um grafo com um ato ao centro e quatro nós — uma comissão,
um órgão, uma pessoa e um processo — ligados por arestas rotuladas *institui*,
*designa*, *vinculado a* e *referente a*.

**O que existe:** a tabela `relacao` liga **ato a ato**, e os tipos são
`Revoga`, `Altera` e `Complementa`. É isso. Não há aresta ato→pessoa,
ato→órgão nem ato→processo no grafo de relações, e não existe tipo de relação
chamado "institui" ou "designa".

Os quatro rótulos do mockup descrevem um **modelo de dados diferente** do que o
portal tem. Alguns desses laços existem em outras tabelas (`ato_pessoa`,
`ato_processo`, `ato_comissao`, `orgao_id`), mas com semântica que não é a do
desenho — `ato_pessoa`, de novo, é menção e não designação.

**Por que isso importa mais do que parece:** a aba de relações responde a uma
pergunta só, e é a mais importante de um portal de normas — *este ato ainda
vale?* Misturar no mesmo grafo arestas de vigência (que decidem validade) com
arestas de menção (que não decidem nada) tornaria o mapa incapaz de responder
justamente aquilo. Vale lembrar que já houve, em produção, 515 atos marcados
como revogados que estavam vigentes, por uma aresta errada.

**O que destravaria:** decidir se o mapa passa a ser um grafo de entidades
(outra tela, outra pergunta) ou continua sendo o mapa de vigência. As duas
coisas cabem no portal; na mesma tela, não.

---

## Outras correções aplicadas na proposta

Três pontos foram ajustados na implementação em vez de recusados:

| Mockup | O que se fez | Por quê |
|---|---|---|
| "Últimos 12 meses" nos cartões do Insights e no gráfico da home | Rótulo por **ano** | `stats.porAno` é anual. O 133.577 é o acervo inteiro, não a janela de doze meses — o rótulo faria o portal afirmar um recorte que ninguém calculou. |
| "26 colegiados cadastrados" num atalho da home | Atalho sem número | O número estava **escrito à mão** no código. O catálogo muda e ninguém lembraria de voltar lá. Número de interface sai da API ou não sai. |
| Link "Acessibilidade" no cabeçalho | Aponta para uma seção de Acessibilidade **criada** na aba Ajuda | Não existia conteúdo de acessibilidade em lugar nenhum do portal. Link para o vazio ensina a desconfiar do resto. |

## O que foi implementado

Sistema visual (tokens de marca nos dois temas, contraste do texto de apoio),
navegação reduzida a quatro rotas + "Mais", Dashboard orientado por tarefas,
Atos e Normas com filtros em camadas, Meu SIAPE com rótulos visíveis e aviso de
fonte oficial, e o cabeçalho de página padronizado em Prazos, O que mudou,
Comissões e Insights.

As invariantes desta rodada estão travadas em
`tools/test_redesign_integrity.mjs`.
