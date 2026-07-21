# Prompts para a documentação visual do Portal

Sete peças para explicar o Portal de Normas e Atos da UFF a quem não é de TI:
servidor da universidade, gestor, estudante, jornalista. Cada seção traz um
prompt pronto para colar numa ferramenta de geração de imagem.

Os números vieram da produção em 21/07/2026. Se refizer as peças daqui a alguns
meses, confira antes em `https://inteligencia.fanara.com.br/api/stats`. Número
velho dentro de imagem dura mais que número velho em texto, porque ninguém relê
uma figura para conferir se ainda vale.

---

## Antes de começar: o que a geração de imagem faz mal

Texto dentro de imagem sai errado. Essas ferramentas desenham letras como
forma, não como escrita, e em português com acento a taxa de erro é alta:
"Resolução" vira "Resoluçao", "Reso1ução", "Resulução". Numa ilustração
decorativa isso passa. Num diagrama que o leitor precisa ler, não.

Por isso as sete peças se dividem em dois grupos:

| Grupo | Peças | Como fazer |
|---|---|---|
| Ilustração, com pouco ou nenhum texto | 1, 6 | Ferramenta de imagem resolve bem |
| Diagrama, em que o texto É o conteúdo | 2, 3, 4, 5, 7 | Peça SVG a uma IA que escreve código, não a uma que desenha |

Para o segundo grupo o prompt abaixo serve igual. Troque a primeira linha por
*"Gere um SVG limpo, sem dependências externas, com estes elementos:"* e mande
para uma ferramenta que devolva código. O texto sai correto porque é texto de
verdade, e você consegue corrigir uma palavra sem refazer a figura inteira.

Se ainda assim quiser gerar diagrama como imagem, peça sem nenhum texto e
escreva os rótulos por cima depois, em qualquer editor.

**As cinco peças de diagrama já estão prontas** em [`figuras/`](figuras/), com
o texto correto e acentuado. Quem as gerou foi o `tools/gerar_figuras_doc.py`:
rode de novo depois de atualizar os números e as cinco saem juntas. As peças 1
e 6 continuam por fazer, e são justamente as duas que ferramenta de imagem
resolve bem.

---

## Identidade visual (repita isto em todos os prompts)

```
Estilo: institucional brasileiro, limpo, sóbrio. Ilustração vetorial plana,
sem gradientes pesados, sem 3D, sem brilho. Fundo branco ou cinza muito claro.

Cores: azul-marinho #003366 como cor principal; amarelo #EAB308 para destaque
e para o que exige atenção; cinza #64748B para apoio e texto secundário;
verde #059669 só para "vigente"; vermelho #DC2626 só para "revogado".
Nada de roxo, degradê neon ou estética de startup.

Sem pessoas com rosto reconhecível. Se precisar de figura humana, use silhueta
ou figura estilizada neutra, sem traço que identifique alguém.
Sem logotipo da UFF (não temos autorização de uso da marca).
```

Essas são as cores do portal no ar. Manter a paleta faz as figuras parecerem
parte do sistema, não ilustrações avulsas coladas depois.

---

## Peça 1 — O problema que o portal resolve

Serve para abrir a apresentação. É a única peça cuja função é fazer o leigo
sentir o problema antes de ouvir a solução.

Onde usar: primeiro slide, topo da página "Sobre", abertura de treinamento.

```
Ilustração vetorial plana, dividida ao meio por uma linha vertical fina.

LADO ESQUERDO (tom acinzentado, sensação de peso):
Uma pilha alta e torta de documentos PDF empilhados, quase desabando,
com cerca de 25 camadas sugerindo décadas acumuladas. Ao lado da pilha,
uma figura humana estilizada de costas, pequena diante da pilha, com uma
lupa na mão, ombros caídos. A pilha não tem nenhuma etiqueta ou divisória.

LADO DIREITO (tom azul-marinho #003366 e branco, sensação de ordem):
Os mesmos documentos, agora organizados em gavetas de arquivo abertas e
etiquetadas, alinhadas. Sobre elas, uma barra de busca retangular simples
flutuando, com um cursor piscando. Linhas finas amarelas #EAB308 ligam a
barra de busca a três gavetas diferentes, mostrando que uma busca alcança
vários pontos ao mesmo tempo.

Sem nenhum texto na imagem. Sem números. Sem logotipo.
Estilo: [colar o bloco de identidade visual]
```

Pedi sem texto porque esta peça é sentimento, não informação. A legenda vai
embaixo, em texto de verdade: *"25 anos de Boletim de Serviço. Antes, um PDF
por vez."*

---

## Peça 2 — A jornada de um ato (diagrama)

Serve para responder "de onde vêm esses dados?". É a peça que mais evita
desconfiança, porque quem não é de TI costuma imaginar que alguém digita tudo
à mão.

Peça como SVG.

```
Diagrama de fluxo horizontal, cinco etapas ligadas por setas da esquerda
para a direita. Cada etapa é um retângulo de cantos arredondados, borda fina
azul-marinho #003366, fundo branco, com um ícone simples no topo e um rótulo
embaixo.

Etapa 1 — ícone de prédio institucional
  Título: "A UFF publica"
  Apoio: "Boletim de Serviço em PDF, quase todo dia útil"

Etapa 2 — ícone de robô simples, sem rosto
  Título: "Um robô baixa"
  Apoio: "Todo dia às 19h10, sem ninguém apertar botão"

Etapa 3 — ícone de documento com linhas sendo separadas em pedaços
  Título: "O texto é recortado"
  Apoio: "Cada ato vira um registro: tipo, número, órgão, data, ementa"

Etapa 4 — ícone de cilindro de banco de dados
  Título: "Vai para a base"
  Apoio: "133 mil atos, de 2001 a hoje"

Etapa 5 — ícone de lupa sobre tela
  Título: "Você pesquisa"
  Apoio: "Por palavra, número, órgão, ano ou nome de pessoa"

Abaixo da etapa 3, uma caixa menor tracejada, em amarelo #EAB308, ligada por
linha pontilhada, com o texto: "É aqui que mora a dificuldade. O PDF não diz
onde um ato termina e o outro começa."

Sem elementos decorativos. Sem sombra. Setas simples, cheias, cinza #64748B.
Estilo: [colar o bloco de identidade visual]
```

Não corte a caixa tracejada para simplificar. Sem ela o diagrama vira
propaganda de processo automático perfeito. Com ela, o leitor entende por que
existe uma página inteira de armadilhas documentadas, e por que de vez em
quando um número sai errado.

---

## Peça 3 — Anatomia de um ato (diagrama)

Serve para ensinar o vocabulário. Quem nunca leu um Boletim não sabe o que é
"ementa", nem por que "número" e "processo SEI" são coisas diferentes.

Peça como SVG.

```
Um retângulo branco central representando uma folha de documento oficial,
em pé, proporção A4, com borda cinza fina e uma sombra muito suave.
Dentro da folha, cinco blocos de linhas cinza simulando texto (sem texto real).

De cada bloco sai uma linha fina amarela #EAB308 apontando para um rótulo
à direita ou à esquerda, alternando os lados. Os rótulos, em azul-marinho,
com uma frase curta de explicação embaixo de cada um:

  "TIPO" — Portaria, Resolução, Determinação de Serviço...
  "NÚMERO E ANO" — a identidade do ato dentro do órgão que o assinou
  "ÓRGÃO" — quem assinou: Reitoria, CEPEx, uma pró-reitoria, uma faculdade
  "EMENTA" — a frase que resume o que o ato faz. É por ela que se pesquisa.
  "PROCESSO SEI" — o número do processo administrativo que originou o ato

No rodapé da folha, em cinza pequeno, uma nota:
"Nem todo ato tem todos os campos. Boletim antigo, digitalizado, tem menos."

Estilo: [colar o bloco de identidade visual]
```

A nota do rodapé não é firula. Só 30% a 70% dos atos registram a matrícula de
quem é citado, e a taxa varia por década. Uma figura que mostre a ficha sempre
completa cria a expectativa errada.

---

## Peça 4 — A teia de relações (diagrama)

Serve para explicar o recurso mais difícil de entender e o mais valioso. "Esta
norma ainda vale?" é a pergunta que ninguém consegue responder folheando PDFs,
porque a resposta está num ato posterior que você não sabe que existe.

Peça como SVG.

```
Diagrama de nós e ligações, disposto no tempo da esquerda (mais antigo) para
a direita (mais recente). Cinco nós circulares, cada um com um rótulo curto
ao lado e um ano embaixo.

  Nó A (2015) — círculo verde #059669
  Nó B (2018) — círculo amarelo #EAB308, ligado a A por seta com o rótulo "ALTERA"
  Nó C (2019) — círculo verde, sem ligação com os outros
  Nó D (2021) — círculo amarelo, ligado a A por seta com o rótulo "ALTERA"
  Nó E (2024) — círculo vermelho #DC2626, ligado a A por seta grossa com o
                 rótulo "REVOGA"

O nó A, depois de receber a seta de E, aparece com preenchimento vermelho claro
e uma tarja diagonal por cima escrito "REVOGADO".

Legenda embaixo, em três linhas com os círculos coloridos como marcador:
  verde   = "Vigente. Nenhum ato posterior o atingiu"
  amarelo = "Alterado. Continua valendo, mas mudou"
  vermelho = "Revogado. Não vale mais"

Uma frase de destaque, à direita, dentro de uma caixa amarela clara:
"O ato de 2015 não sabe que foi revogado em 2024. Quem sabe é o portal."

Estilo: [colar o bloco de identidade visual]
```

Aquela frase na caixa amarela carrega a peça inteira. Um documento não anuncia
a própria morte: a revogação mora no ato novo, não no velho. É por isso que ler
o PDF original não responde à pergunta e o índice responde.

---

## Peça 5 — O mapa da cooperação internacional

A peça que mais impressiona sem exigir explicação. Mostra alcance num olhar.

Peça como SVG. Mapa-múndi com pontos é fácil de errar em geração de imagem:
os países saem deformados e a posição dos pontos não corresponde a lugar nenhum.

```
Mapa-múndi em projeção simples, contornos de continente preenchidos em cinza
muito claro #E2E8F0, sem fronteiras internas, sem nomes de país no mapa.

Sobre o mapa, círculos azul-marinho #003366 semitransparentes marcando países,
com o raio proporcional ao número de acordos:

  França 89, Portugal 86, Espanha 67, Itália 47, Alemanha 38,
  Colômbia 37, Argentina 35, Estados Unidos 25

Mais 51 países com acordos menores, como pontos pequenos de tamanho uniforme,
distribuídos em Europa, América Latina, África e Ásia.

Destaque em amarelo #EAB308 um único ponto no Brasil, sudeste, rotulado "UFF",
com linhas finas curvas saindo dele para os oito países nomeados acima.

Canto superior direito, uma caixa branca com borda fina:
  "1.467 acordos"
  "59 países"
  "2001 a 2026"

Estilo: [colar o bloco de identidade visual]
```

Cuidado com o que a figura sugere. Cada acordo é um ato administrativo
aprovado, não um convênio necessariamente ativo hoje, porque nada no Boletim
registra o encerramento de um acordo. Em material institucional, a legenda
precisa dizer "acordos aprovados no período", e não "parcerias ativas".

---

## Peça 6 — O acervo em números

Serve para dar escala. Funciona solto, em post ou slide de abertura.

```
Infográfico vertical, seis blocos empilhados, cada um com um número grande em
azul-marinho #003366 e uma linha de texto curta embaixo em cinza. Um ícone
simples e plano à esquerda de cada número. Muito espaço em branco entre blocos.

  133.106  — atos indexados
  4.921    — boletins lidos, de 2001 a 2026
  981      — órgãos emissores diferentes
  129.483  — atos vigentes hoje
  1.239    — atos revogados
  49.667   — atos com processo SEI vinculado

Sem gráfico de pizza, sem barra, sem porcentagem. Só o número e o que ele é.
Estilo: [colar o bloco de identidade visual]
```

Número grande é onde a geração de imagem mais erra, e dígito trocado passa
despercebido porque ninguém confere uma figura. Se gerar como imagem, leia cada
número em voz alta comparando com a lista acima antes de publicar. Ou gere como
SVG e não tenha o problema.

---

## Peça 7 — O que tem em cada aba (diagrama)

Serve para o usuário que abriu o portal e não sabe por onde começar.

Peça como SVG.

```
Grade de cartões, três colunas, cada cartão com ícone simples no topo,
nome da aba em azul-marinho e uma linha de explicação em cinza:

  Planilha       — "Todos os atos, com filtro por tipo, órgão, ano e palavra"
  Relações       — "Quem revoga ou altera quem"
  Chefias        — "Quem ocupa qual função, e desde quando"
  Meu SIAPE      — "Os atos que citam a sua matrícula"
  Insights       — "Padrões do acervo: aposentadorias, deslocamentos, volume"
  Mandatos       — "Prazos de designação e o que já venceu"
  Prazos         — "O que tem data para acabar"
  Jornada        — "Setores em trabalho flexível ou programa de gestão"
  Cooperação     — "Acordos com instituições, com mapa e filtro por país"
  Analisar Ato   — "Cole o texto de um ato e veja os campos separados"

Estilo: [colar o bloco de identidade visual]
```

Sobre a aba "Analisar Ato": ela separa os campos com expressões regulares, não
com inteligência artificial. Se a legenda ou o material de divulgação disser
"IA", vai estar dizendo algo falso sobre a ferramenta.

---

## O que não pedir

Tela falsa do portal. Uma interface inventada por IA vira material de
treinamento errado, e o usuário vai procurar na tela real um botão que nunca
existiu. Para mostrar o portal, tire print do portal.

Gráfico com dado inventado. Se a ferramenta desenhar barras "de exemplo",
alguém vai citar aquele número. Use os valores desta página ou nenhum.

Brasão ou logo da UFF. Não temos autorização de uso da marca, e IA de imagem
gera versões deformadas de brasões oficiais, o que fica pior do que não ter.

Rosto de pessoa. O portal lida com registros funcionais nominais. Ilustração
com rosto, mesmo inventado, sugere que aquela pessoa está na base.

Metáfora de cérebro, circuito ou robô humanoide. O sistema é um indexador de
texto. Estética de "IA" prometeria uma capacidade que ele não tem.

---

## Se for fazer só algumas

Com três peças você cobre o essencial: a 1 (o problema), a 2 (de onde vêm os
dados) e a 4 (por que o índice responde o que o PDF não responde).

A 5 é a que melhor circula sozinha em rede social e apresentação institucional.
A 6 envelhece rápido, então refaça junto com os números.
