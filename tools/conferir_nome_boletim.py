# -*- coding: utf-8 -*-
"""Confere o ANO do nome do arquivo do BS contra o ano impresso no PDF.

Rode ANTES de importar. O nome do arquivo e a identidade do boletim em todo o
pipeline (`importar_v2.php`, boletim_id()), e quem digita esse nome erra: um
`21-16.pdf` que era `21-25.pdf` ja entrou na base e virou um conjunto de atos
duplicados que precisou de limpeza manual. Renomear o arquivo depois nao
desfaz a importacao -- por isso a conferencia e antes, nao depois.

O SINAL
    Capa e cabecalho das paginas internas concordam no ano ENTRE SI e os dois
    discordam do nome do arquivo. Ai o suspeito e o nome.

    Nao confunda com o defeito INVERSO, que o extrator ja trata sozinho
    (`metadados_bs`): capa discordando do interno E do nome, caso dos seis
    boletins de marco/2017 com capa de um modelo de 2007. Ver
    docs/GUIA-EXTRACAO-BS.md, "A capa mente sobre o ano".

USO
    python tools/conferir_nome_boletim.py <pdf|pasta> [...]
    python tools/conferir_nome_boletim.py ../dados/boletins/2026

Sai com codigo 1 se achar suspeito, 0 se estiver limpo -- da para encadear
num gancho de importacao.

Medido em 27/07/2026 sobre os 5.797 PDFs do acervo: 0 suspeitos.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extrair_boletim as eb  # noqa: E402

try:
    import fitz
except ImportError:
    print("PyMuPDF (fitz) ausente. pip install pymupdf")
    sys.exit(2)

# So o ANO da data. Dia/mes sao ruido de OCR em boletim digitalizado antigo.
ANO_EM_DATA = re.compile(r"\d{2}/\d{2}/(\d{4})")

# Um cabecalho de verdade se repete em toda pagina; uma data solta no corpo de
# um ato, nao. 12 paginas ja passam folgado do limiar de 2.
PAGINAS_LIDAS = 12
MIN_REPETICOES = 2


def anos_no_pdf(caminho):
    """(ano_da_capa, ano_do_cabecalho_interno) -- qualquer um pode ser None."""
    doc = fitz.open(caminho)
    paginas = [doc[i].get_text() for i in range(min(PAGINAS_LIDAS, doc.page_count))]
    doc.close()

    m = ANO_EM_DATA.search("\n".join(paginas[:3]))
    capa = m.group(1) if m else None

    contagem = {}
    for pagina in paginas[1:]:
        topo = "\n".join(pagina.split("\n")[:4])
        for ano in ANO_EM_DATA.findall(topo):
            contagem[ano] = contagem.get(ano, 0) + 1
    interno = None
    if contagem:
        candidato, n = max(contagem.items(), key=lambda kv: kv[1])
        if n >= MIN_REPETICOES:
            interno = candidato

    return capa, interno


def confere(caminho):
    """None se ok/indeterminado; (ano_nome, ano_conteudo) se suspeito."""
    capa, interno = anos_no_pdf(caminho)
    nome = eb._ano_do_arquivo(caminho)
    if not (capa and interno and nome):
        return None
    if capa == interno and int(capa) != nome:
        return (nome, capa)
    return None


def pdfs_de(alvo):
    if os.path.isfile(alvo):
        return [alvo]
    achados = []
    for raiz, _dirs, arquivos in os.walk(alvo):
        for arquivo in sorted(arquivos):
            if arquivo.lower().endswith(".pdf"):
                achados.append(os.path.join(raiz, arquivo))
    return achados


def main(argv):
    if not argv:
        print(__doc__)
        return 2

    alvos = []
    for a in argv:
        if not os.path.exists(a):
            print("nao existe: %s" % a)
            return 2
        alvos.extend(pdfs_de(a))

    suspeitos, indeterminados = [], 0
    for caminho in alvos:
        try:
            r = confere(caminho)
        except Exception as e:                      # PDF corrompido nao para a fila
            print("ERRO ao ler %s: %s" % (os.path.basename(caminho), e))
            continue
        if r is None:
            indeterminados += 1
        else:
            suspeitos.append((caminho, r))

    print("PDFs conferidos: %d" % len(alvos))
    if not suspeitos:
        print("nenhum nome suspeito.")
        return 0

    print("\nSUSPEITOS (%d) -- confira o PDF antes de importar:" % len(suspeitos))
    for caminho, (nome, conteudo) in suspeitos:
        print("  %-28s nome diz %s, mas capa E paginas internas dizem %s"
              % (os.path.basename(caminho), nome, conteudo))
    print("\nSe o nome estiver errado, RENOMEIE ANTES de importar. Se o boletim")
    print("ja foi importado com o nome errado, renomear nao basta: a importacao")
    print("seguinte cria os atos de novo sob o boletim certo e os antigos ficam")
    print("como duplicata -- precisa de limpeza na base.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
