# -*- coding: utf-8 -*-
"""Camada de rotulagem fina sobre os candidatos do classificador de recorte.

Entrada:  corpus_propostas.json (2.819 candidatos com dispositivo)
Saída:    rotulados.json   — linhas finais (ods, vinculo, confianca, meta, justificativa)
          descartados.json — candidatos rejeitados, com motivo (auditável)

Regra de ouro (mesma do METODOLOGIA-ODS.md): só entra com meta nomeável e com o
sinal no DISPOSITIVO/objeto do ato — menção não é vínculo.
"""
import json, io, re, unicodedata
from collections import Counter

import os as _os

# Caminhos resolvidos a partir da localizacao DESTE arquivo (repo/tools/ods/),
# para o script rodar de qualquer diretorio.
#   root = a pasta que contem o repo (portal-normas-uff/)
#   SCR  = pasta de trabalho dos JSONs intermediarios. Eles NAO entram no repo
#          (sao grandes e regeraveis); o padrao e backfill-ods/trabalho/.
#          Sobrescreva com a variavel de ambiente ODS_TRABALHO.
_AQUI = _os.path.dirname(_os.path.abspath(__file__))
root = _os.path.dirname(_os.path.dirname(_os.path.dirname(_AQUI)))
SCR = _os.environ.get("ODS_TRABALHO", _os.path.join(root, "backfill-ods", "trabalho"))
_os.makedirs(SCR, exist_ok=True)


def strip(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s or '') if not unicodedata.combining(c)).lower()

cands = json.load(io.open(SCR + r"\corpus_propostas.json", encoding="utf-8"))

# ---------------------------------------------------------------- descartes duros
RE_DESCARTE = [
 ("afastamento/cessao (ato de pessoal; tema e da pessoa, nao do ato)",
  re.compile(r'afastamento do pais|manifestar-se favoravel\w* (ao|a) afastamento|autorizar a cessao|alterar a lotacao')),
 ("mocao (manifestacao politica, nao norma)",
  re.compile(r'\bmocao\b|mocao de (apoio|louvor|repudio)')),
 ("concurso/progressao/incentivo (gestao de pessoal)",
  re.compile(r'abertura de concurso|incentivo a qualificacao|gratificacao de estimulo|homologar? .{0,30}concurso|validar o titulo|revalidacao do diploma|homologar o ato .{0,30}diploma')),
 ("aditivo/convenio de estagio (operacao de ensino)",
  re.compile(r'termo aditivo ao convenio para estagio|convenio para estagio|concessao de estagios')),
 ("reestruturacao administrativa generica",
  re.compile(r'reestruturacao administrativa')),
 ("deferimento individual (caso de um interessado)",
  re.compile(r'deferimento (parcial )?do pedido d[oa] discente|pelo deferimento do recurso')),
 ("concessao individual de auxilio (folha, nao programa)",
  re.compile(r'conceder .{0,40}auxilio[- ](alimentacao|transporte|pre[- ]escolar|natalidade)|auxilio[- ]alimentacao a[o]? servidor')),
 ("doacao de material (nao e politica)",
  re.compile(r'doacao de (material|bens)|doacao feita')),
 ("nomeacao/designacao de cargo CD/FG (pessoal)",
  re.compile(r'(nomear|designar|dispensar|exonerar)[^.]{0,200}(cargo de direcao|codigo cd|cd-\d|fg-\d|substituto eventual)|alterar na portaria [^.]{0,80}(excluir|incluir): (cd|fg)-\d')),
 # Ato de ESTRUTURA: remaneja codigos de chefia (CD/FG) entre unidades. O
 # termo-ODS mora no NOME DA UNIDADE remanejada ("Divisao de Saude
 # Ocupacional", "Ouvidoria", "Restaurante Universitario") — nao no objeto do
 # ato. Mesma familia da isca de parceiro/cargo/area (§5.1 da metodologia).
 ("ato de estrutura: remanejo de codigos de chefia",
  re.compile(r'situacao atual\s+situacao transformada|chefia codigo|alterar na portaria n?o? ?24\.153')),
 ("progressao/merito/adicional individual (folha)",
  re.compile(r'progressao por (capacitacao|merito)|conceder .{0,25}(progressao|adicional de)|retificar[^.]{0,60}que concedeu')),
 # O termo-ODS no nome do ORGAO QUE ASSINA nao e vinculo: a Escola de
 # Governanca em Gestao Publica assina centenas de atos de capacitacao.
 ("termo-ODS no nome do orgao emissor (Escola de Governanca)",
  re.compile(r'escola de governanca em gestao publica(?!.{0,80}(institui|cria|regulament))')),
]

# --------------------------------------------------- ato de pessoal (guarda forte)
# "Designa Vangelina Lins Melo, Nutricionista-Habilitacao" entrava na ODS 2
# porque o CARGO da pessoa (nutricionista) ou a unidade dela (Restaurante
# Universitario) casava o tema — o ato nao faz nada de politica alimentar, so
# move uma pessoa. Mesma familia da isca do nome proprio, agora pelo cargo de
# quem recebe o ato. Medido em producao: 292 das 1.662 ligacoes (17,6%).
#
# A GUARDA E O OBJETO DO VERBO: se o que vem depois e uma PESSOA, e ato de
# pessoal e sai; se e um COLEGIADO ("designa membros da Comissao de Acoes
# Afirmativas"), e execucao legitima de politica e fica.
RE_PESSOAL_VERBO = re.compile(
    r'^(designa|dispensa|nomeia|nomear|exonera|reconduz|torna sem efeito a nomea|declara vago|concede)')
RE_COLEGIADO = re.compile(
    r'comissao|comite|grupo de trabalho|\bgt\b|conselho|camara|colegiado|subcomissao|equipe|banca|nucleo')

# O dispositivo raramente comeca no verbo: vem "resolve: 1- designar...",
# "resolve: art. 1o - dispensar...", "decide: I - designar...". Sem descascar
# esses marcadores de item, o verbo nunca casa e o ato de pessoal passa batido
# (foi o que deixou 71 designacoes na ODS 2, todas pela "Divisao de Moradia
# Estudantil / Restaurante Universitario" no nome da funcao).
RE_ABRE = re.compile(r'^(resolve[m]?|decide[m]?|determina|resolvo)\s*:?\s*')
RE_ITEM = re.compile(r'^(?:art\.?\s*\d+\s*[ºo°]?\s*[-–.]?\s*|\d+\s*[-–.)]\s*|[ivx]+\s*[-–.)]\s*)+', re.I)

def eh_ato_de_pessoal(em, disp):
    """Verbo de pessoal + objeto que NAO e colegiado -> ato de pessoal."""
    alvo = em.strip()
    if not alvo:
        alvo = RE_ITEM.sub('', RE_ABRE.sub('', disp).strip()).strip()
    if not RE_PESSOAL_VERBO.match(alvo):
        return False
    return not RE_COLEGIADO.search(alvo[:200])

# ---------------------------------------------------------------- clusters (ordem = prioridade)
# cada regra: (nome, teste sobre ementa+disp, ods, vinculo, confianca, meta, justificativa)
def T(pat): return re.compile(pat)

# Clusters que so valem com o sinal na EMENTA (ver comentario no laco principal).
# `creche`: a Agenda Academica cita creche na programacao dentro do CORPO, e isso
# fazia "Designar representantes do Comite Cientifico da Agenda Academica" virar
# evidencia de ODS 5. Medido em 2012 (curado a mao), 2013 e 2014.
SO_EMENTA = {"coop-politica", "creche"}

CLUSTERS = [
 # --- ODS 16: governança institucional (fundadores) ---
 ("integridade-plano", T(r'(programa e )?plano de integridade|programa de integridade'),
  [16], "proposta", "alta", "IPEA 16.5/16.6",
  "Plano/Programa de Integridade — combate a corrupcao e instituicoes eficazes"),
 ("gestao-riscos", T(r'politica de gestao de riscos'),
  [16], "proposta", "alta", "IPEA 16.6",
  "Politica de Gestao de Riscos — governanca e instituicoes responsaveis"),
 ("cgirc-comite", T(r'comite de governanca|governanca, integridade, riscos'),
  [16], "proposta", "alta", "IPEA 16.6",
  "Institui/reestrutura o comite central de governanca (CGIRC)"),
 ("psi-seginfo", T(r'politica de seguranca da informacao|\bpsi\b'),
  [16], "proposta", "alta", "IPEA 16.6",
  "Politica de Seguranca da Informacao — capacidade institucional"),
 ("lgpd-dados", T(r'protecao de dados pessoais|privacidade|\blgpd\b'),
  [16], "proposta", "alta", "IPEA 16.6/16.10",
  "Governanca de protecao de dados pessoais (LGPD)"),
 ("ouvidoria", T(r'\bouvidoria\b'),
  [16], "proposta", "media", "IPEA 16.6/16.10",
  "Ouvidoria — acesso a informacao e responsividade institucional"),

 # --- ODS 15: CEUA / bem-estar animal (ANTES da etica generica: "comissao de
 #     etica NO USO DE ANIMAIS" casaria no cluster de etica publica) ---
 ("ceua-fundadora", T(r'uso de animais no ensino e na pesquisa|criar a comissao de etica no uso de animais'),
  [15, 16], "proposta", "alta", "THE 15.2.5 / IPEA 15",
  "Regulamenta o uso etico de animais (CEUA) — bem-estar animal e etica em pesquisa"),
 ("ceua-regimento", T(r'comissao de etica no uso de animais|\bceua\b'),
  [15], "execucao", "media", "IPEA 15",
  "Operacao da CEUA (regimento/composicao)"),
 ("bioterio", T(r'\bbioterio'),
  [15], "proposta", "media", "IPEA 15",
  "Estrutura/regulamento de bioterio — bem-estar animal"),

 ("etica-regimento", T(r'(regimento|codigo) .{0,30}(comissao de etica|de etica)(?! no uso)|constitui .{0,20}comissao de etica(?! no uso)'),
  [16], "proposta", "media", "IPEA 16.6",
  "Estrutura permanente de etica publica"),
 ("etica-composicao", T(r'comissao de etica(?! no uso)'),
  [16], "execucao", "media", "IPEA 16.6",
  "Operacao da Comissao de Etica (composicao/alteracao)"),
 ("resol-conflitos", T(r'resolucao pacifica de conflitos'),
  [16], "proposta", "alta", "IPEA 16.1/16.6",
  "Procedimentos de resolucao pacifica de conflitos"),

 # --- ODS 1/2/4/10: assistencia estudantil PROAES ---
 ("proaes-alimentacao", T(r'(programa|diretrizes|edital)[^.]{0,80}(auxilio alimentacao|complementacao de alimenta)|(auxilio alimentacao|complementacao de alimenta)[^.]{0,80}(programa|diretrizes)|restaurante universitario'),
  [2, 10], "proposta", "alta", "IPEA 2.1 / THE 2.x",
  "Programa de alimentacao estudantil — acesso a alimento"),
 ("proaes-moradia", T(r'auxilio moradia|moradia universitaria|apoio .{0,15}moradia|acolhimento para estudantes'),
  [1, 4, 10], "proposta", "alta", "IPEA 1.4/4.5",
  "Programa de moradia/acolhimento estudantil — permanencia de vulneraveis"),
 ("proaes-emergencial", T(r'auxilio emergencial|emprestimo emergencial|inclusao digital|acesso a internet'),
  [1, 4, 10], "proposta", "alta", "IPEA 1.4/4.5",
  "Auxilio emergencial/inclusao digital — permanencia de vulneraveis"),
 ("proaes-afirmativas", T(r'politicas afirmativas|pessoas trans|indigenas e quilombolas|estudantes indigenas|refugiad'),
  [10, 5, 4], "proposta", "alta", "IPEA 10.2/10.3 / THE 10.6.4",
  "Programa de politicas afirmativas — reducao de desigualdades"),
 ("proaes-deficiencia", T(r'estudante com deficiencia'),
  [10, 4], "proposta", "alta", "IPEA 10.2 / THE 10.6.4",
  "Apoio a estudantes com deficiencia — inclusao"),
 ("proaes-outros", T(r'assistencia estudantil|permanencia estudantil|material didatico|educacao infantil|gestantes'),
  [4, 10], "proposta", "alta", "IPEA 4.3/4.5",
  "Programa de assistencia estudantil — acesso e permanencia"),

 # --- ODS 10: inclusao / afirmativas (fora PROAES) ---
 ("nome-social", T(r'nome social de travestis|inclusao do nome social'),
  [5, 10], "proposta", "alta", "IPEA 10.3 / THE 10.6.4",
  "Regulamenta o uso do nome social — inclusao de pessoas trans"),
 ("acessibilidade-estrutura", T(r'(cria|institui|regulament)\w* .{0,40}acessibilidade|comissao .{0,30}acessibilidade|cartilha de acessibilidade'),
  [10], "proposta", "media", "IPEA 10.2 / THE 10.6.4",
  "Estrutura/instrumento permanente de acessibilidade"),
 ("heteroident", T(r'heteroidentificacao|verificacao .{0,20}(etnico|quilombola|deficiencia|renda)'),
  [10], "execucao", "media", "IPEA 10.3",
  "Operacao da politica de cotas (bancas de verificacao)"),
 # Equidade de GENERO tem nomenclatura propria e nao casava nenhum padrao de
 # acoes afirmativas: a CPEG e "Comissao Permanente PARA Equidade de Genero"
 # (nao "de"), e nasceu do GT "Mulheres na Ciencia". Achado pelo mantenedor —
 # a portaria fundadora (68.317/2022) estava na cauda longa como "caso unico".
 ("equidade-genero",
  T(r'equidade (de|para) genero|permanente para equidade|mulheres na ciencia'
    r'|plano .{0,15}equidade de genero|\bcpeg\b'),
  [5, 10], "proposta", "alta", "IPEA 5.1/5.5 / THE 5.6.x",
  "Estrutura/politica permanente de equidade de genero"),
 ("sepad-afide", T(r'\bsepad\b|equidade, politicas afirmativas|acoes afirmativas, diversidade e equidade|\bafide\b|\bcppiq\b|politicas .{0,15}indigenas e quilombolas'),
  [10, 5], "proposta", "alta", "IPEA 10.2/10.3",
  "Estrutura permanente de equidade e acoes afirmativas"),

 # --- ODS 5/8/16: assedio, genero ---
 ("assedio", T(r'\bassedio\b'),
  [5, 8, 16], "proposta", "media", "THE 10.6.11 / IPEA 5.2/8.8",
  "Enfrentamento ao assedio — ambiente seguro de trabalho e estudo"),
 ("creche", T(r'\bcreche\b'),
  [5, 4], "proposta", "media", "IPEA 5.4/4.2",
  "Creche/educacao infantil — corresponsabilidade de cuidado"),

 # --- ODS 3/8: saude e trabalho ---
 ("saude-servidor", T(r'saude do servidor|cissp|qualidade de vida|bem viver|saude ocupacional|juntas? medicas'),
  [3, 8], "proposta", "media", "THE 3.3.7 / IPEA 8.8",
  "Saude e qualidade de vida do servidor"),
 ("cipa-seguranca", T(r'\bcipa\b|prevencao de acidentes'),
  [8, 5], "proposta", "media", "IPEA 8.8",
  "Prevencao de acidentes e assedio no trabalho (CIPA)"),
 ("pdp-capacitacao", T(r'plano de desenvolvimento de pessoas|\bpdp\b|acoes de desenvolvimento'),
  [4, 8], "proposta", "media", "IPEA 4.3/8.5",
  "Desenvolvimento e capacitacao de pessoal"),
 # norma geral da jornada = proposta; adesao de setor ("aprova o plano de flexibilizacao") = execucao
 ("jornada-norma", T(r'(regulamenta|dispoe sobre|estabelece os criterios)[^.]{0,60}(flexibilizacao da )?jornada'),
  [8], "proposta", "media", "IPEA 8.5",
  "Norma geral de organizacao da jornada de trabalho"),
 ("jornada-adesao", T(r'flexibilizacao da jornada|programa de gestao e desempenho'),
  [8], "execucao", "media", "IPEA 8.5",
  "Adesao/operacao setorial da jornada flexibilizada ou PGD"),

 # --- ODS 12/13: sustentabilidade institucional ---
 ("pls-a3p", T(r'logistica sustentavel|\bpls\b|\ba3p\b|gestao socioambiental'),
  [12, 13], "proposta", "alta", "IPEA 12.7 / THE 13.x",
  "Plano institucional de sustentabilidade (PLS/A3P)"),
 ("residuos-gestao", T(r'(programa|plano|comissao|grupo de trabalho|laboratorio) .{0,50}residuos|gerenciamento de residuos|coleta seletiva'),
  [12], "proposta", "media", "IPEA 12.5",
  "Gestao de residuos"),
 ("sustentab-estrutura", T(r'(nucleo|comissao|laboratorio|comite) .{0,60}sustentab|desenvolvimento sustentavel'),
  [12], "proposta", "media", "IPEA 12.6",
  "Estrutura permanente de sustentabilidade"),

 # --- ODS 9: inovacao ---
 ("inovacao", T(r'propriedade (industrial|intelectual)|transferencia de tecnologia|incubadora|agencia de inovacao|\bagir\b|ciencia aberta'),
  [9], "proposta", "media", "IPEA 9.5",
  "Inovacao, propriedade intelectual e transferencia de tecnologia"),

 # --- ODS 17: cooperacao (por ultimo entre os tematicos — padrao mais generico) ---
 # A POLITICA de cooperacao e proposta; o CONVENIO INDIVIDUAL e execucao dela.
 # Sem esta separacao, 671 instrumentos individuais entravam como "proposta" e a
 # ODS 17 sozinha respondia por 68% das propostas do dossie inteiro — numero que
 # nao sobrevive a leitura de um avaliador. Ratificar um acordo com a
 # Universidade X nao e a UFF propor uma politica; e ela executar a politica de
 # cooperacao que ja tem. O acervo tem as duas coisas, e elas contam separado.
 ("coop-politica",
  T(r'regulament\w+.{0,45}(cotutela|convenio|acordo de cooperacao|cooperacao)'
    r'|regime de cotutela'
    r'|politica de internacionalizacao'
    r'|(cria|institui|reestrutura|altera)\w*.{0,80}(assuntos internacionais|relacoes internacionais|internacionalizacao)'
    r'|(superintendencia|assessoria|escritorio|coordenacao|diretoria).{0,40}(internacion|relacoes internacionais)'
    r'|(plano|projeto|programa|politica) .{0,30}internacionaliz'
    r'|normas .{0,35}(celebracao|celebrar|firmar).{0,25}(convenio|acordo)'),
  [17], "proposta", "alta", "THE 17.2 / IPEA 17.17",
  "Politica/regulamento institucional de cooperacao e internacionalizacao"),
 ("coop-internacional", T(r'cooperacao internacional|cotutela|intercambio .{0,30}(universi|internacional)'),
  [17], "execucao", "media", "THE 17.2 / IPEA 17.6",
  "Acordo internacional firmado (instrumento individual — execucao da politica)"),
 ("coop-tecnica", T(r'acordo de cooperacao|protocolo de (cooperacao|intencoes)|termo de cooperacao'),
  [17], "execucao", "baixa", "THE 17.2 / IPEA 17.17",
  "Acordo interinstitucional firmado (instrumento individual — execucao da politica)"),
]

# ---------------------------------------------------------------- ensino: ODS pela EMENTA (nome do curso)
ENSINO_TEMA = {
 2:  T(r'alimentacao|alimentos|nutricao'),
 3:  T(r'saude|enfermagem|psican|psiquiatr|medicina'),
 4:  T(r'educacao|pedagogia|ensino|docencia'),
 5:  T(r'genero|mulher'),
 6:  T(r'recursos hidricos|saneamento|agua'),
 7:  T(r'energia'),
 8:  T(r'seguranca do trabalho|engenharia de producao|gestao'),
 9:  T(r'tecnologia|computacao|inovacao'),
 10: T(r'inclusiva|inclusao|acessibilidade|diversidade|educacao especial'),
 11: T(r'urbanismo|patrimonio|cidade'),
 12: T(r'ambiental|sustentab|turismo'),
 13: T(r'clima'),
 14: T(r'oceano|marinh|geofisica|pesca'),
 15: T(r'biodiversidade|biologia|geografia|florest'),
 16: T(r'direito|defesa civil|justica|seguranca publica'),
 17: T(r'internacional'),
}

# "inclusao" e palavra comum do jargao administrativo ("inclusao de disciplina",
# "de pre-requisito", "de servidor na comissao") e NAO significa inclusao social.
# Sem esta guarda, alteracao curricular de Estatistica virava evidencia de ODS 10.
RE_INCLUSAO_GENERICA = T(r'inclusao de (disciplin|pre-?requisit|component|carga|servidor|membro|vaga)')
# "etica" idem, quando e o NOME do curso/area ("Bioetica", "Etica na Comunicacao").
RE_ETICA_NOME = T(r'bioetica|etica na comunicacao|etica aplicada')

def rotula_ensino(em):
    ods = [n for n, pat in ENSINO_TEMA.items() if pat.search(em)]
    if 10 in ods and RE_INCLUSAO_GENERICA.search(em) and not T(
            r'inclusiv|acessibilidad|deficien|indigen|quilombol|afirmativ|diversidade|equidade').search(em):
        ods.remove(10)
    if 16 in ods and RE_ETICA_NOME.search(em) and not T(
            r'comissao de etica|codigo de etica|comite de etica').search(em):
        ods.remove(16)
    return ods

# ---------------------------------------------------------------- laço principal
rotulados, descartados = [], []
clu_cnt = Counter()
for c in cands:
    em = strip(c.get("ementa", ""))
    disp = c.get("disp", "")
    texto = em + " " + disp
    row = {"tipo": c["tipo"], "sigla": c["sigla"], "numero": c["numero"], "ano": c["ano"], "orgao": c.get("orgao"),
           "ementa": c["ementa"][:200]}

    # ato de pessoal: decidido pelo OBJETO do verbo, antes de qualquer cluster
    if eh_ato_de_pessoal(em, disp):
        row["motivo"] = "ato de pessoal (designa/dispensa PESSOA; o tema esta no cargo dela, nao no ato)"
        descartados.append(row); clu_cnt["DESCARTE:ato de pessoal"] += 1
        continue

    # Designacao de COLEGIADO sobrevive (e execucao de politica), mas o tema tem
    # de vir da EMENTA — que e onde o colegiado se nomeia. O corpo desses atos e
    # lista de membros e programacao de evento: fonte certa de contaminacao.
    # Foi assim que "Designa representantes do Comite Cientifico da Agenda
    # Academica" virou evidencia de creche (2012) e de assistencia estudantil
    # (2014) — os dois pelo corpo, nenhum pela ementa.
    so_ementa_este_ato = bool(em.strip()) and bool(RE_PESSOAL_VERBO.match(em.strip()))

    # descartes duros primeiro (dominam qualquer cluster)
    motivo = next((m for m, pat in RE_DESCARTE if pat.search(texto)), None)
    if motivo:
        row["motivo"] = motivo; descartados.append(row); clu_cnt["DESCARTE:" + motivo.split(" ")[0]] += 1
        continue

    if c["vinc"] == "ensino":
        ods = rotula_ensino(em)
        if not ods:
            row["motivo"] = "ensino sem tema-ODS no NOME do curso (tema vinha de disciplina no corpo)"
            descartados.append(row); clu_cnt["DESCARTE:ensino-sem-tema"] += 1
            continue
        row.update({"ods": ods[:2], "vinculo": "ensino", "confianca": "media",
                    "meta": "THE educational programmes",
                    "justificativa": "Oferta academica sobre tema-ODS (nome do curso/disciplina na ementa)",
                    "cluster": "ensino-tema"})
        rotulados.append(row); clu_cnt["ensino-tema"] += 1
        continue

    # SO_EMENTA: cluster que so vale se o sinal estiver na EMENTA. A ementa
    # declara o que o ato E; o corpo cita contexto. Sem isto, "aprova o acordo
    # com o Instituto X" cai em coop-politica porque o corpo do instrumento
    # menciona "regulamenta a cooperacao" no meio do clausulado.
    hit = next(((nome, ods, vinc, conf, meta, just) for nome, pat, ods, vinc, conf, meta, just in CLUSTERS
                if pat.search(em if (nome in SO_EMENTA or so_ementa_este_ato) else texto)), None)
    if not hit:
        row["motivo"] = "sem cluster — resíduo p/ curadoria (vinc=%s ods=%s)" % (c["vinc"], c["ods"])
        descartados.append(row); clu_cnt["DESCARTE:residuo"] += 1
        continue

    nome, ods, vinc, conf, meta, just = hit
    # execução regex nunca promove: se o recorte disse execução e o cluster diz proposta,
    # vale o VERBO (recorte) — a não ser que o cluster seja intrinsecamente fundador (regimento etc.)
    if c["vinc"] == "execucao" and vinc == "proposta":
        vinc, conf = "execucao", ("media" if conf == "alta" else "baixa")
    # 'pesquisa' do recorte vem de menção a "projeto de pesquisa" no corpo — só confiar
    # quando o cluster É de pesquisa/cooperação; num cluster estrutural (regimento, comitê),
    # a menção é contaminação de ato vizinho e vale o cluster.
    if c["vinc"] == "pesquisa" and nome.startswith(("coop-",)):
        vinc = "pesquisa"
    row.update({"ods": ods, "vinculo": vinc, "confianca": conf, "meta": meta,
                "justificativa": just, "cluster": nome})
    rotulados.append(row); clu_cnt[nome] += 1

io.open(SCR + r"\rotulados.json", "w", encoding="utf-8").write(json.dumps(rotulados, ensure_ascii=False, indent=1))
io.open(SCR + r"\descartados.json", "w", encoding="utf-8").write(json.dumps(descartados, ensure_ascii=False, indent=1))

print("rotulados:", len(rotulados), "| descartados:", len(descartados))
print("\npor vinculo final:", dict(Counter(r["vinculo"] for r in rotulados)))
print("\nclusters:")
for k, v in clu_cnt.most_common(40):
    print("  %-38s %4d" % (k, v))
