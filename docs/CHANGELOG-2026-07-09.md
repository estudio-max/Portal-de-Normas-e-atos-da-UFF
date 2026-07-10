# Correções e novidades do Portal de Normas e Atos da UFF — 09/07/2026

Duas frentes nesta rodada: dois consertos avulsos que já estavam testados e
confirmados ao vivo mas nunca tinham sido commitados, e a construção de duas
abas novas — **Insights** e **Prazos** — a segunda delas passando por dois
bugs reais encontrados em produção e corrigidos no mesmo dia.

---

## 1. Extrator — ano abreviado no título ancora no ano do boletim — `ee48e2a`

Títulos curtos sem data por extenso (comuns em Decisões/Resoluções antigas de
colegiado, ex. "RESOLUÇÃO 064/17") aceitavam o ano do número com 2 a 4
dígitos e nunca normalizavam — o filtro de Ano mostrava "17"/"211" em vez de
"2017"/"2011".

`corrige_ano_futuro()` agora usa o **ano do próprio Boletim de Serviço** (a
única data certa disponível) sempre que o ano do ato não vier com 4 dígitos
limpos, em vez de tentar adivinhar o dígito que falta.

## 2. Modo escuro — CSS de inversão que faltava — `e8e9b88`

O botão "Modo escuro" já aplicava a classe `.fotofobia` em `<html>` e
persistia a escolha em `localStorage` desde que o recurso entrou — o React
funcionava perfeitamente — mas **nunca existiu CSS para essa classe**, só o
componente tinha sido commitado. `html.fotofobia { filter: invert(1)
hue-rotate(180deg); }` inverte a página inteira; seguro aqui porque o app não
usa `<img>` (só texto/SVG via lucide-react), então não precisa reescrever
cada componente com variantes `dark:`.

## 3. Backend — três endpoints novos: `/api/insights`, `/api/analitico`, `/api/prazos` — `9e8d934`

- **`/api/insights`**: agregações para o painel — KPIs, atividade por dia,
  ranking de órgãos com cobertura de processo SEI, volume mensal, composição
  por tipo de ato, situação de vigência. Aceita recorte por ano.
- **`/api/analitico`**: rotatividade de chefias (permanência entre titulares
  sucessivos de uma mesma posição, com **dedup por SIAPE** — republicação ou
  retificação da mesma designação não conta como troca de titular) e normas
  revogadas/alteradas que outros atos ainda referenciam ("normas zumbis").
- **`/api/prazos`**: entrega os atos-candidatos a ter uma data-limite (via
  busca FULLTEXT sobre o corpo do ato) para a extração das datas rodar no
  cliente. Ver os itens 5 e 6 — este endpoint precisou de dois ajustes depois
  de observar o comportamento ao vivo.

## 4. Interface — abas 📈 Insights e 📅 Prazos — `b758bfa`

**Insights**: painéis em SVG/CSS puro (sem dependência nova) — calendário de
atividade por dia estilo GitHub, ranking de órgãos com a fatia de cobertura
SEI embutida na própria barra, volume mensal, composição por tipo, situação
de vigência, e uma narrativa automática (frases geradas por regra a partir
dos próprios números, ex. *"A Reitoria é o órgão mais ativo em 2026: 893
atos (30% do total)"*). Traz também a rotatividade de chefias e as normas
zumbis. A **meia-vida das normas** ficou de fora por enquanto: só ~1% do
acervo foi revogado ou alterado até agora — pouco para uma curva de
sobrevivência confiável — e o painel exibe essa contagem com uma nota de que
**ativa sozinho** conforme o legado entra e as revogações se acumulam.

**Prazos**: radar de datas-limite — inscrições, recursos, entregas, prazos
de contrato, validades — extraídas do texto dos atos. A extração roda no
**cliente** (`extrairPrazos` em `dataSource.ts`, mesma lógica nos modos API e
estático) e é ancorada em **intenção**: só considera uma data perto de uma
palavra de prazo (inscrição/recurso/entrega) e longe de contexto que
desqualifica (licença, suspensão, mandato, período aquisitivo) — sem essa
âncora, a primeira versão testada confundia data de licença/designação com
data-limite. Cada prazo mostra também **para quem serve**
(`inferirPublico`: candidatos, discentes, docentes, fornecedores,
comunidade...) e o assunto do ato, além do trecho exato de onde a data foi
tirada. Filtros por janela, público, tipo e confiança; linha do tempo em
SVG; impressão com o mesmo conteúdo em tabela limpa (Data · Contagem · Para
quem · Tipo · Ato/assunto · Trecho). O selo **"revisado depois"** avisa
quando um ato posterior alterou ou revogou o ato de origem — o prazo pode
ter mudado.

Ambas as abas são **apoio, não fonte oficial** — sempre remetem ao ato de
origem.

## 5. Ajuda — documenta Chefias, Insights e Prazos — `bee521f`

Três seções novas explicando o que cada aba faz e, principalmente, as
ponderações de uso: Chefias só reflete designações publicadas no período
indexado; Insights ganha densidade conforme o legado entra; Prazos é um
apoio automático que pode falhar ou classificar errado, com prazos relativos
usando a data do ato como referência. Reforço equivalente no bloco
"Importante" e duas perguntas novas no FAQ.

## 6. Dois bugs de produção encontrados e corrigidos no mesmo dia (dentro do commit `9e8d934`)

A aba Prazos foi publicada vazia duas vezes seguidas — cada vez por um motivo
diferente, os dois só visíveis observando o comportamento **ao vivo** (sem
acesso a PHP/MySQL local para reproduzir):

- **Truncamento do corpo.** O endpoint cortava o texto em 2.800 caracteres
  antes de mandar pro cliente. O cronograma de inscrições e recursos dos
  editais costuma vir perto do **fim** do documento — o corte estava
  descartando mais de 60% dos prazos reais. Corrigido para mandar o corpo
  praticamente inteiro (até 12.000 caracteres; o corpo típico de um ato tem
  no máximo ~7 KB).
- **Amostra sem filtro de recência.** Com o truncamento já corrigido, a aba
  continuava vazia. Causa real: o acervo em produção já tem o **legado
  completo carregado (2001–2026, 127 mil+ atos)** — muito maior do que a
  base usada para validar a extração durante o desenvolvimento. A consulta
  que busca "atos com sinal de prazo" trazia até 900 resultados **sem
  ordenar por data**; como o MySQL não garante ordem nesse caso, a amostra
  saía dominada por atos antigos (só 24 dos 900 eram de 2026), cujo prazo —
  se algum dia existiu — já venceu há anos. Corrigido restringindo a atos
  assinados nos **últimos 3 anos** (cobre até os prazos relativos mais
  longos observados no corpo, tipo "5 anos a contar da assinatura") e
  ordenando do mais recente para o mais antigo, para o limite de resultados
  nunca descartar o que é relevante.

---

## Como publicar (HostGator)

Tudo nesta rodada precisa apenas do build recompilado da interface e do
`index.php` — **não há migração de banco nem re-execução do Python**.

1. `cd repo && npm run build` gera `dist/`.
2. Subir o conteúdo de `dist/` (index.html + assets/) para a raiz do site, e
   `backend/api/index.php` para `.../api/`.
3. Testar `uff.fanara.com.br/api/prazos` diretamente no navegador: o JSON
   deve trazer `dataAto` majoritariamente de 2024–2026.
