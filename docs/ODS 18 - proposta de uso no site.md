## O que eu faria no Portal

A estrutura atual deve ser **preservada integralmente**. O ODS 18 deve entrar como um **18º agrupamento na mesma camada dos demais**, sem criar uma nova arquitetura.

Hoje vocês têm:

> **Atos da UFF × Objetivos de Desenvolvimento Sustentável**
> Dossiê de evidência: os atos normativos que documentam o que a UFF propôs e institucionalizou em cada uma das **17 ODS da Agenda 2030**.

Com a inclusão do ODS 18, eu mudaria para:

> **Atos da UFF × Objetivos de Desenvolvimento Sustentável**
> Dossiê de evidência: os atos normativos que documentam o que a UFF **propôs e institucionalizou** em cada um dos Objetivos de Desenvolvimento Sustentável considerados pelo Portal.

Assim vocês **não precisam escrever “18 ODS da ONU”**, que seria conceitualmente incorreto.

---

# 1. O ODS 18 entraria exatamente como um novo card

A tela ficaria conceitualmente:

```text
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ 1                  │ │ 2                  │ │ 3                  │
│ Erradicação...     │ │ Fome zero          │ │ Saúde...            │
└────────────────────┘ └────────────────────┘ └────────────────────┘

...

┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ 16                 │ │ 17                 │ │ 18                 │
│ Paz, justiça...    │ │ Parcerias...       │ │ Igualdade           │
│                    │ │                    │ │ étnico-racial      │
└────────────────────┘ └────────────────────┘ └────────────────────┘
```

Eu **não criaria uma aba separada chamada “ODS 18”**.

A experiência atual já comunica muito bem o conceito:

**ODS → evidências documentais da UFF.**

---

# 2. Mas há uma particularidade que precisa aparecer

Aqui está o ponto que eu considero mais importante.

Os cards atuais representam os **17 ODS da Agenda 2030 da ONU**.

O ODS 18 é diferente: é uma **iniciativa brasileira de igualdade étnico-racial construída no contexto da Agenda 2030**.

Portanto, visualmente eu manteria a mesma hierarquia, mas acrescentaria uma pequena identificação no card ou na página interna.

Por exemplo:

### No card

**18**

**Igualdade étnico-racial**

`X proposta(s) · X exec. · X ens. · X pesq.`

E na página do ODS 18:

> **Sobre este objetivo**
>
> O ODS 18 — Igualdade Étnico-Racial é uma iniciativa brasileira desenvolvida no contexto da Agenda 2030, voltada à promoção da igualdade étnico-racial e ao enfrentamento das desigualdades e discriminações que atingem especialmente a população negra e os povos indígenas.

Isso resolve a questão sem prejudicar a experiência de quem já conhece a interface.

---

# 3. Eu também mudaria uma frase da tela atual

Hoje está:

> “...em cada uma das **17 ODS da Agenda 2030**.”

Além da questão do número, existe uma questão gramatical: **“cada um dos ODS”**, porque *objetivo* é masculino.

Mas eu aproveitaria para deixar a frase mais precisa.

### Minha sugestão:

> **Dossiê de evidência: os atos normativos que documentam o que a UFF propôs e institucionalizou em cada Objetivo de Desenvolvimento Sustentável.**

É melhor porque:

* não precisa atualizar o número se surgir outro objetivo;
* não cria uma afirmação sobre a ONU ter 18 ODS;
* descreve exatamente o que a funcionalidade faz;
* continua funcionando para os 17 ODS atuais;
* funciona para o ODS 18.

---

# 4. A descrição abaixo também está muito boa — e eu manteria a ideia

Vocês têm:

> “Classificação assistida por IA com curadoria humana, ancorada nas métricas de política do THE Impact Rankings e nas metas nacionais do IPEA/ODS-Brasil — cada ligação carrega justificativa e meta.”

Isso é **excelente para o ODS 18**.

Porque vocês não precisam simplesmente perguntar:

> “Este ato tem relação com ODS 18?”

A classificação pode ser:

```text
ATO
 ↓
ODS 18
 ↓
META
 ↓
JUSTIFICATIVA
```

E isso mantém a característica mais valiosa que a tela já anuncia:

> **“cada ligação carrega justificativa e meta.”**

---

# 5. Eu faria o ODS 18 funcionar com o mesmo mecanismo

Por exemplo:

### Ato

**Resolução nº XXX/2026**

### Ligação

**ODS 18 — Igualdade Étnico-Racial**

### Meta

**Meta 18.X**

### Justificativa

> O ato institucionaliza política de ações afirmativas destinada à promoção da igualdade étnico-racial no âmbito da Universidade.

Isso é muito melhor do que simplesmente colocar:

```text
ODS: 18
```

Porque vocês conseguem defender a classificação.

---

# 6. Há uma coisa na interface que eu prestaria atenção

Na tela aparece:

> **15 proposta(s)**
> `· 8 exec. · 2018–2026`

e a explicação diz:

> “o número forte é o de **propostas (atos fundadores)**; execução, pesquisa e ensino aparecem separados, de propósito.”

Isso significa que o ODS 18 também precisa obedecer **exatamente à mesma taxonomia interna**.

Eu não criaria categorias especiais para o ODS 18.

Se o sistema entende:

```text
proposta
execução
ensino
pesquisa
```

para os ODS 1–17, o ODS 18 deve usar a mesma classificação.

Isso é fundamental para que os números sejam comparáveis.

---

# 7. ODS 18 não deve significar “qualquer ato sobre população negra”

Esse é provavelmente o maior risco na implementação.

O sistema não deve fazer:

```text
encontrou "negro"
       ↓
ODS 18
```

Nem:

```text
encontrou "indígena"
       ↓
ODS 18
```

A classificação deve continuar seguindo a lógica que vocês já adotaram:

**ato → evidência → justificativa → objetivo/meta.**

Por exemplo, uma resolução que menciona "população negra" incidentalmente não necessariamente deveria ser classificada como evidência do ODS 18.

---

# 8. Eu acrescentaria uma regra específica ao documento `METODOLOGIA-ODS.md`

Como vocês já exibem na própria tela:

> `Método completo (âncoras, armadilhas, taxonomia dos vínculos): docs/METODOLOGIA-ODS.md`

eu acrescentaria uma seção específica:

```md
## ODS 18 — Igualdade Étnico-Racial

O ODS 18 constitui uma iniciativa brasileira desenvolvida no
contexto da Agenda 2030 e deve ser tratado no Portal como eixo
temático adicional para agrupamento de evidências documentais.

A classificação de um ato no ODS 18 exige evidência de que seu
conteúdo institucionaliza, regulamenta, cria, altera, executa ou
estrutura política, programa, ação ou mecanismo relacionado à
igualdade étnico-racial.

A mera ocorrência de termos relacionados à população negra,
povos indígenas, racismo ou diversidade não é suficiente,
isoladamente, para estabelecer o vínculo.

Cada vínculo deve possuir:
- justificativa;
- meta relacionada, quando aplicável;
- evidência textual ou contextual;
- indicação de que o vínculo foi explícito ou inferido.
```

Isso protege muito a qualidade da classificação feita pela IA.

---

# 9. E aqui vejo uma oportunidade muito boa para o Portal

A tela já diz:

> **“quem consulta é quem enxerga o erro primeiro.”**

Isso combina perfeitamente com o ODS 18.

Eu criaria, na página interna do ODS 18, algo como:

> **Classificação assistida por IA · curadoria humana**

e permitiria que o usuário sinalizasse:

* vínculo incorreto;
* vínculo ausente;
* meta incorreta;
* justificativa inadequada;
* ato errado.

Assim, o ODS 18 pode começar com uma classificação mais conservadora e ir sendo refinado pela curadoria.

---

# 10. E não tentaria classificar retroativamente tudo de uma vez

Eu faria uma implantação em três fases.

### Fase 1 — Estrutura

Adicionar:

```text
ODS 18
Igualdade Étnico-Racial
```

ao cadastro existente.

### Fase 2 — Evidências

Encontrar atos que tenham relação clara com:

* igualdade racial;
* ações afirmativas;
* população negra;
* povos indígenas;
*
