# -*- coding: utf-8 -*-
import json, io, os, re, unicodedata
from collections import Counter, defaultdict
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
def ntipo(s):
    return re.sub(r'[^A-Z]', '', strip(s).upper())
NORM = {"RESOLUCAO", "DECISAO", "INSTRUCAONORMATIVA", "NORMADESERVICO", "PORTARIA"}

def dispositivo(corpo):
    m = re.search(r'\b(resolve[m]?|decide[m]?|determina|resolvo)\b\s*:?', corpo)
    return corpo[m.start():m.start()+3500] if m else corpo[:1500]

RE_ADMIN = re.compile(r'(torna(r)? sem efeito a nomea|declara(r)? vago|exonera|\bnomea(r)?\b|concede(r)? (pensao|aposentadoria|abono|progressao|licenca|gratificacao)|homologa\w* .{0,40}concurso|banca examinadora|comissao examinadora|reconhecimento do titulo|reconhecer o titulo|solicitacao de reconhecimento|indeferir)')
RE_ESTAGIO = re.compile(r'concessao de estagio|estagios (obrigatorios|curriculares)|convenio .{0,60}estagio')
RE_FOUND = re.compile(r'(institui(r)?|fica(m)? instituid|cria(r)?\b|fica(m)? criad|aprova(r)? (a politica|o programa|o plano|o regulamento|as diretrizes|a norma|o codigo)|fixa(r)? as diretrizes|estabelec\w+ (a politica|as diretrizes|normas|criterios)|regulament\w+|dispoe sobre a politica)')
RE_PESQ = re.compile(r'projeto de pesquisa|pd&?i|pesquisa denominad')
RE_EXEC = re.compile(r'designa(r)?|constitui(r)? .{0,20}comissao|reconduz|altera(r)? a (composicao|portaria|comissao)|comissao (permanente|local|interna|especial)')
RE_CURRIC = re.compile(r'trabalho de conclusao|atividades complementares|criad\w+ .{0,10}disciplinas|progressao|estagio curricular|revisao de nota|regulamento do curso')
# oferta acadêmica sobre tema-ODS: vínculo próprio 'ensino' (métrica THE de educational programmes),
# nunca 'proposta' — curso sobre recursos hídricos não é política hídrica da instituição
# "lato sensu"/"stricto sensu"/"nivel mestrado" SOZINHOS nao indicam oferta
# academica: aparecem como QUALIFICADOR do publico-alvo ("estudantes de
# programas de pos-graduacao stricto sensu"). Foi assim que a IN PROAES 38 —
# a politica de acoes afirmativas na pos — virou "ensino" e caiu fora por nao
# ter tema-ODS no nome de curso nenhum. Agora o termo de nivel so conta junto
# de um verbo de CRIACAO/APROVACAO de curso.
RE_ENSINO = re.compile(
    r'cria(?:cao|r|da)?\s*(?:d[oe]s?\s*)?(?:novo\s*)?(?:curso|programa de pos-?graduacao|disciplina)'
    r'|estabelece o curriculo|curriculo (?:pleno|do curso)'
    r'|regimento interno do (?:programa|curso)|grade horaria'
    r'|criad\w+ .{0,15}disciplin'
    r'|ajuste curricular|alteracao curricular'
    r'|(?:aprova|estabelece)\w*.{0,45}(?:curso|programa).{0,30}(?:lato sensu|stricto sensu|especializacao|mestrado|doutorado)')

ODS = {
 1:[r'auxilio moradia', r'auxilio emergencial', r'apoio .{0,15}moradia', r'vulnerabilidade socioeconomica'],
 2:[r'restaurante universitario', r'seguranca alimentar', r'auxilio alimentacao'],
 3:[r'saude mental', r'saude do servidor', r'saude do trabalhador', r'qualidade de vida', r'atencao psicossocial', r'bem viver', r'promocao (da|a) saude'],
 4:[r'permanencia estudantil', r'acesso e permanencia', r'taxas de evasao', r'assistencia estudantil', r'inclusao digital', r'educacao inclusiva'],
 5:[r'assedio', r'violencia contra a mulher', r'equidade de genero', r'nome social', r'gestante', r'creche', r'educacao infantil', r'diversidade e equidade', r'\bafide\b', r'\bmulheres\b'],
 6:[r'saneamento', r'efluentes', r'recursos hidricos'],
 7:[r'eficiencia energetica', r'energia (solar|fotovoltaica|renovavel)'],
 8:[r'seguranca (do|no) trabalho', r'saude ocupacional', r'\bcipa\b', r'prevencao de acidentes', r'plano de desenvolvimento de pessoas', r'programa de gestao e desempenho', r'trabalho decente', r'flexibilizacao da jornada'],
 9:[r'nucleo de inovacao', r'ciencia aberta', r'incubadora', r'propriedade (intelectual|industrial)', r'inovacao tecnologica'],
 10:[r'acoes afirmativas', r'acao afirmativa', r'\bcotas\b', r'heteroidentificacao', r'acessibilidade', r'\binclusao\b', r'indigenas', r'quilombolas', r'pessoas com deficiencia', r'reserva de vagas', r'\bequidade\b', r'\bsepad\b', r'\bcppiq\b', r'\bdiversidade\b'],
 11:[r'patrimonio (cultural|historico)', r'mobilidade urbana', r'abert\w+ (a|à) comunidade'],
 12:[r'logistica sustentavel', r'\bpls\b', r'\ba3p\b', r'coleta seletiva', r'residuos', r'gestao ambiental', r'sustentabilidade', r'compras sustentaveis', r'pgrss', r'socioambiental'],
 13:[r'mudancas climaticas', r'\bclima\b', r'emissoes de carbono', r'educacao ambiental', r'efeito estufa'],
 14:[r'reciclagem de navios', r'ecossistema marinho', r'recursos pesqueiros', r'\boceano'],
 15:[r'bem-estar animal', r'\bceua\b', r'biodiversidade', r'manejo (sustentavel|da fauna|da flora)'],
 16:[r'governanca', r'integridade', r'gestao de riscos', r'corrupcao', r'\betica\b', r'ouvidoria', r'transparencia', r'\blgpd\b', r'seguranca da informacao', r'protecao de dados', r'plano de integridade', r'resolucao pacifica de conflitos'],
 17:[r'cooperacao internacional', r'acordo de cooperacao', r'internacionalizacao', r'\bcotutela\b', r'relatorio .{0,10}ods'],
}

def lure(n, disp):
    if n==8 and re.search(r'cargo de (tecnico|engenheiro) .{0,25}seguranca (do|no) trabalho', disp) and RE_ADMIN.search(disp): return True
    if n in (5,10) and re.search(r'(assistente social|vaga(s)? reservada|reservadas a (negros|pretos|pardos)|pessoa com deficiencia)', disp) and RE_ADMIN.search(disp): return True
    if n in (7,12,17,15) and RE_ESTAGIO.search(disp): return True
    if n==5 and re.search(r'comunicacao social', disp) and re.search(r'nomea', disp): return True
    return False

def classifica(ementa, corpo):
    disp = dispositivo(corpo)
    # janela estreita contra contaminação por ato vizinho no corpo extraído
    full = strip(ementa) + " " + disp[:1200]
    if RE_ADMIN.search(disp) and not RE_FOUND.search(disp):
        if re.search(r'pensao|aposentadoria|\bvago\b|exonera|reconhecimento do titulo|examinadora|homologa', disp):
            return ("nenhuma", [])
    ensino = bool(RE_ENSINO.search(strip(ementa)) or RE_ENSINO.search(disp[:600]))
    if RE_PESQ.search(full):
        vinc = "pesquisa"
    elif ensino:
        vinc = "ensino"
    elif RE_FOUND.search(disp):
        vinc = "proposta"
    elif RE_EXEC.search(disp):
        vinc = "execucao"
    else:
        vinc = "nenhuma"
    ods = []
    for n, pats in ODS.items():
        if any(re.search(p, full) for p in pats):
            if lure(n, full): continue
            if n==4 and RE_CURRIC.search(disp) and not re.search(r'permanencia|acesso|inclusao|evasao|assistencia estudantil|vulnerab', full): continue
            ods.append(n)
    if not ods:
        return ("nenhuma", [])
    if vinc == "nenhuma":
        vinc = "execucao"
    return (vinc, sorted(ods))

def as_list(d):
    if isinstance(d, list): return d
    if isinstance(d, dict):
        for k in ("atos","data","registros","items"):
            if isinstance(d.get(k), list): return d[k]
    return []

seen=set(); vinc_cnt=Counter(); dist=defaultdict(Counter); n_norm=0; propostas=[]
for y in range(2001,2027):
    p=os.path.join(root,"reprocessamento-2026-07-15",str(y),"atos.json")
    if not os.path.isfile(p): continue
    for a in as_list(json.load(io.open(p,encoding="utf-8"))):
        if not isinstance(a,dict): continue
        if ntipo(a.get("tipo","")) not in NORM: continue
        key=(ntipo(a.get("tipo","")), strip(a.get("sigla","")), re.sub(r'\D','',str(a.get("numero",""))), a.get("ano"))
        if key in seen: continue
        seen.add(key); n_norm+=1
        corpo_s = strip(a.get("corpo_busca") or "")
        v,ods=classifica(a.get("ementa",""), corpo_s)
        vinc_cnt[v]+=1
        for o in ods: dist[o][v]+=1
        if v != "nenhuma" and ods:
            propostas.append({"tipo":a.get("tipo"),"sigla":a.get("sigla"),"numero":a.get("numero"),
                              "ano":a.get("ano"),"orgao":a.get("orgao"),"ementa":(a.get("ementa") or "")[:300],"vinc":v,"ods":ods,
                              "disp":dispositivo(corpo_s)[:600]})

io.open(SCR+r"\corpus_propostas.json","w",encoding="utf-8").write(json.dumps(propostas,ensure_ascii=False,indent=1))
out=["ATOS NORMATIVOS unicos varridos: %d"%n_norm,
     "vinculo: %s"%dict(vinc_cnt),
     "prop+pesq+ensino (com ODS): %d"%len(propostas),"","ODS   Prop  Pesq  Ens   Exec"]
NM={1:"Pobreza",2:"Fome",3:"Saude",4:"Educacao",5:"Genero",6:"Agua",7:"Energia",8:"Trabalho",9:"Inovacao",10:"Desig",11:"Cidades",12:"Consumo",13:"Clima",14:"VidaAgua",15:"VidaTerra",16:"Instituic",17:"Parcerias"}
for o in range(1,18):
    c=dist[o]; out.append("ODS %2d %-9s %5d %5d %5d %5d"%(o,NM[o],c['proposta'],c['pesquisa'],c['ensino'],c['execucao']))
io.open(SCR+r"\corpus_resultado.txt","w",encoding="utf-8").write("\n".join(out))
print("\n".join(out))
