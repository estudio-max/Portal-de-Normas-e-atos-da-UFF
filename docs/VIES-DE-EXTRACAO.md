# Viés de extração — como um painel publica número falso sem nada acusar

> Escrito em 17/08/2026, depois de o portal publicar durante meses uma taxa de
> deferimento de revalidação de **21%** quando o acervo dizia cerca de **metade**.
> Não é um relato de bug: é o método que faltava, e a lista de conferência que
> passa a valer para toda extração e todo backfill.

Complementa o [GUIA-EXTRACAO-BS.md](GUIA-EXTRACAO-BS.md), que ensina a escrever
o padrão. Este aqui trata do que acontece **depois** que ele funciona.

---

## O caso

A aba Revalidação mostrava, na graduação: 92 a 100% de deferimento entre 2006 e
2009, **zero absoluto de 2011 a 2017** (614 decisões), e 64 a 98% de 2023 em
diante. Dois anos — 2019 e 2020 — não apareciam de todo.

A causa: **todos os padrões exigiam o verbo `deferir`, `indeferir` ou
`homologar`. O CEPEx defere escrevendo `Aprovar`.**

```
DECIDE: 1- Aprovar a revalidação do Diploma, nível de Graduação em
Antropologia, obtido por FULANA, junto a <instituição>, <país>
```

É a **mesma frase** do indeferimento com o verbo trocado. O indeferimento tinha
padrão; o deferimento não tinha nenhum. Medido no acervo local, 2010–2022:
**511 deferimentos invisíveis** contra 696 vistos.

Nada acusava. O extrator acertava tudo o que via, e o que ele não via não
deixava rastro: sem erro, sem log, sem contagem estranha. O CI ficava verde
porque cada caso de teste havia sido escrito **a partir do padrão** — escreve-se
o indeferimento porque foi o indeferimento que se programou.

---

## As sete regras

### 1. Nunca escreva a decisão dentro do padrão

Errado — a decisão é literal, e o oposto dela é invisível:

```python
r"manifestar-se\s+pelo\s+indeferimento\s+do\s+pedido\s+de\s+revalida..."
```

Certo — o verbo é capturado, e quem classifica é o código:

```python
r"manifestar-se\s+pelo\s+(?P<neg>in)?deferimento\s+do\s+pedido\s+de\s+revalida..."
```

Vale para qualquer eixo binário: deferido/indeferido, ativo/encerrado,
entrada/saída, concedido/negado.

### 2. O inventário de verbos é o ponto cego

Um padrão cobre as redações que **você conhece**. O acervo tem 25 anos e várias
gerações de redator. Antes de confiar numa série, levante os verbos que o corpo
dos atos realmente usa:

```python
# conte TODO verbo decisório perto do assunto, sem filtrar pelo que voce espera
VERBOS = r'(defer\w*|indefer\w*|homolog\w*|aprov\w+|conced\w+|autoriz\w+|'
         r'reconhec\w+|declar\w+|revalidar|indefer\w*)'
```

Foi assim que `Aprovar` apareceu — e ele não estava em hipótese nenhuma minha.

### 3. Teste de laboratório não é evidência sobre o acervo

Eu troquei uma palavra numa frase **que eu mesmo escrevi**, vi o extrator ficar
cego, e concluí que essa era a causa dos zeros. O defeito era real, mas **não
era a causa**: o acervo não usava aquela frase para deferir, usava outra.

> Trocar a palavra prova que o padrão é assimétrico.
> Só o texto bruto diz qual frase o acervo usa.

A pergunta que separa as duas coisas: **"o padrão não pega" ou "o ato não
existe"?** Só se responde contando no corpo dos atos.

### 4. Contagem e taxa não têm a mesma garantia

Uma **contagem** só pode crescer quando o acervo terminar de ser processado —
"mínimo verificado" é honesto. Uma **taxa** calculada sobre subconjunto
enviesado se move para qualquer lado. Escrever "mínimo verificado" ao lado de um
percentual empresta a ele uma garantia que ele não tem.

### 5. O gráfico tem de desenhar a composição, não só o volume

A série de decisões por ano desenhava apenas o total. Setecentas decisões e
sete deferimentos produziam colunas de aparência perfeitamente normal. Com a
fatia deferida desenhada **dentro** da coluna, dez das vinte colunas ficam sem
verde nenhum e o defeito salta aos olhos.

> Um número errado que se denuncia vale mais que dez conferências que ninguém faz.

### 6. Duas armadilhas na hora de medir

- **Janela contamina.** Contar `indeferir` numa janela em volta de `revalida`
  traz "Indeferir o pedido de **ADICIONAL DE INSALUBRIDADE**", que em 2015 é a
  maioria dos casos. Exija a frase, não a proximidade.
- **O campo é `corpo_texto`**, não a ementa. A busca do portal não varre o corpo:
  procurar a frase exata devolve 20 atos onde o extrator casa 135.

### 7. Os dois caminhos de escrita andam juntos

Padrão novo entra no extrator (`tools/extrair_boletim.py`) **e** no backfill
(`backend/importar/backfill_ato_revalidacao.php`). Um só dos dois cria
divergência silenciosa: o ato aparece ou some conforme o caminho que o gravou.

---

## Lista de conferência antes de publicar série nova

- [ ] Nenhum padrão tem a decisão escrita como literal — todos capturam o verbo.
- [ ] Levantei os verbos do corpo dos atos **sem filtrar pela minha hipótese**.
- [ ] Comparei o que o extrator devolve com o que o texto bruto tem, por ano.
- [ ] O teste **vira o verbo** de cada caso real e exige que o extrator continue
      enxergando (ver `tools/teste_revalidacao.py`).
- [ ] Extrator e backfill têm os mesmos padrões.
- [ ] O gráfico desenha a composição, e não só o volume.
- [ ] O texto na tela distingue contagem de taxa.
- [ ] Conferi a série **ano a ano**: zero absoluto num período longo, ou ano
      inteiro ausente, é suspeita — processo real raramente é 0% ou 100%.

## O sinal que denuncia

**Zero absoluto e cem por cento absoluto são quase sempre artefato.** Um
processo humano com centenas de casos não dá zero por sete anos seguidos e volta
a 83%. Quando a série fizer isso, o padrão está descrevendo a si mesmo, não o
acervo.

Também vale para o silêncio: um `try/catch` que deixa o painel vazio "porque a
tabela ainda não existe nesta base" tem a mesma natureza — some sem avisar.
Prefira o painel dizer que não tem dado a fingir que o dado é zero.
