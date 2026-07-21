# -*- coding: utf-8 -*-
"""Gera docs/REGEX.md a partir do FONTE.

O catálogo dos regex tem que sair do código, não ser escrito à mão: a lista é
grande (55 no extrator, mais os do PHP) e documentação copiada envelhece na
primeira mudança de padrão. Aqui o padrão e a explicação vêm do próprio
arquivo — o comentário que já está acima de cada regex vira o texto da
entrada.

Se um regex aparecer em docs/REGEX.md sem explicação, o certo é escrever o
comentário NO CÓDIGO e rodar isto de novo, não editar o .md.

Uso:  python tools/gerar_doc_regex.py
"""
import io
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Agrupamento por TRABALHO que o regex faz, não por ordem no arquivo: quem
# procura "por que este ato não foi capturado" quer a família de títulos junta,
# e não descobrir que ela está espalhada entre a linha 135 e a 223.
TEMAS = [
    ('Achar onde um ato começa e termina',
     'O problema central do extrator. O boletim é um PDF corrido: nada nele '
     'marca o fim de um ato e o início do outro. Estes padrões são a única '
     'coisa separando um acervo indexado de um blocão de texto.',
     ['TITULO_RE', 'TITULO_SIGA_RE', 'TITULO_CURTO_RE', 'BOUNDARY_NAO_ATO_RE',
      '_RESOLVE_CORTE']),

    ('Recusar o que parece ato mas não é',
     'Uma norma antiga CITADA dentro de outro documento tem a mesma forma de '
     'um título. Sem estas guardas, a citação vira um ato fantasma com data '
     'errada, e o mesmo ato aparece várias vezes vindo de boletins diferentes.',
     ['_FRAGMENTO_INI_RE', '_QUE_ANTES_RE']),

    ('Ler o cabeçalho do boletim',
     'Identificam a edição: número, ano, data e a seção/página em que o ato '
     'saiu. A identidade real do boletim é o nome do ARQUIVO — o número '
     'impresso diverge — mas estes campos entram como enriquecimento.',
     ['HEADER_BS_RE', 'ANO_NUM_RE', 'DATA_BS_RE', 'SECAO_RE']),

    ('Identificadores: processo, documento, matrícula',
     'Números que ligam o ato a outros sistemas da UFF (SEI) e a pessoas '
     '(SIAPE). São o que permite responder "quais atos citam a minha '
     'matrícula".',
     ['PROC_RE', 'SEI_DOC_RE', 'SEI_DOC_PAREN_RE', 'SIAPE_RE']),

    ('Nomes de pessoas',
     'Capturar nome próprio em texto livre é heurística, não certeza. Os dois '
     'padrões convivem porque o boletim mudou de estilo: houve época de CAIXA '
     'ALTA e época de Title Case.',
     ['NOME_RE', 'NOME_CAPS_RE', '_NAO_NOME', '_NOMEIA_EXT']),

    ('Ementa: a frase que resume o ato',
     'A ementa é por onde se pesquisa. Quando o ato não traz uma formal, o '
     'extrator sintetiza uma a partir do dispositivo — e aí precisa cortar '
     'preâmbulo, boilerplate e enumeração para sobrar a frase que interessa.',
     ['PREAMBULO_RE', 'BOILERPLATE_EMENTA_RE', '_ENUM_EMENTA_RE',
      '_STOP_EMENTA_RE', '_CLAUSULA_INI_RE', 'ACAO_EMENTA_RE']),

    ('Relações entre atos (revoga, altera, cita)',
     'O que o portal acrescenta ao acervo: um ato não anuncia a própria '
     'revogação, ela é publicada anos depois em outro ato. Estes padrões '
     'acham a referência; quem resolve o alvo é o resolver_relacoes_v2.php.',
     ['REF_RE', 'BS_REF_RE']),

    ('Chefias: quem foi designado para quê',
     'Designação e dispensa de função. A armadilha documentada aqui é '
     'classificar pelo DISPOSITIVO e não por menção: "dispensar em virtude '
     'de sua nomeação" é uma dispensa, não uma nomeação.',
     ['FUNCAO_RE', '_VERBO_FUNC', '_SUBST_FUNC', '_ANAFORA_UNID']),

    ('Mandatos e prazos',
     'Quanto dura uma designação e quando ela começou a contar. O fim de um '
     'mandato normalmente não gera ato, então o máximo honesto é "o prazo '
     'venceu e não há ato posterior".',
     ['_MANDATO_RE', '_MANDATO_UNID_RE', '_INICIADO_RE', '_APARTIR_RE']),

    ('Aposentadoria',
     'Tipo e base legal. O grosso da dificuldade é distinguir a CONCESSÃO de '
     'uma retificação que apenas menciona uma concessão anterior.',
     ['_APOSENT_RETRO_RE', '_APOSENT_DISPOSITIVO_RE', '_APOSENT_COMPULSORIA_RE',
      '_APOSENT_VOLUNTARIA_RE', '_APOSENT_INVALIDEZ_RE', '_ART40_RE',
      '_INCISO_ART40_RE']),

    ('Deslocamento de servidor (remoção, redistribuição)',
     'Para onde a pessoa foi e por quê. Separa movimentação interna da UFF de '
     'saída para instituição externa.',
     ['_RED_QQ', '_RED_EXCL', '_INST_EXTERNA', '_UFF_MARK', '_REMOVER',
      '_M_SAUDE', '_M_CONJ', '_M_PERMUTA', '_M_OFICIO', '_M_PEDIDO',
      '_DEST_SIGLA', '_DEST_NOME']),

    ('Limpeza de texto',
     'Lixo de OCR e de extração de PDF que atrapalha tudo o que vem depois.',
     ['CTRL_RE']),
]


def comentario_acima(linhas, idx):
    """Comentário que explica o regex da linha idx (0-based).

    Primeiro tenta o bloco de `#` colado acima. Se não houver, sobe pela
    SEQUÊNCIA de definições até achar o comentário que encabeça o grupo — o
    arquivo usa esse estilo de propósito em famílias como HEADER_BS_RE /
    ANO_NUM_RE / DATA_BS_RE / SECAO_RE, em que um comentário só descreve as
    quatro. Tratar isso como "sem documentação" seria erro do leitor, não
    lacuna do código. Devolve (linhas, herdado?).
    """
    def bloco(i):
        out = []
        while i >= 0 and linhas[i].rstrip().startswith('#'):
            out.append(linhas[i].rstrip().lstrip('#').strip())
            i -= 1
        return list(reversed(out))

    direto = bloco(idx - 1)
    if direto:
        return direto, False

    # sobe enquanto as linhas anteriores forem definição/continuação, não vazio
    i = idx - 1
    while i >= 0:
        l = linhas[i].rstrip()
        if l.strip() == '':
            return [], False
        if l.startswith('#'):
            return bloco(i), True
        i -= 1
    return [], False


def extrai_python(caminho):
    """{nome: (padrao, [linhas de comentario], numero_da_linha)}"""
    txt = io.open(caminho, encoding='utf-8').read()
    linhas = txt.split('\n')
    achados = {}
    for m in re.finditer(r'^(_?[A-Za-z][A-Za-z0-9_]*)\s*=\s*re\.compile\(', txt, re.M):
        nome = m.group(1)
        n_linha = txt[:m.start()].count('\n')
        # corpo do compile(): equilibra parenteses a partir do '('
        i = m.end() - 1
        prof, j = 0, i
        while j < len(txt):
            if txt[j] == '(':
                prof += 1
            elif txt[j] == ')':
                prof -= 1
                if prof == 0:
                    break
            j += 1
        padrao = txt[i + 1:j].strip()
        coment, herdado = comentario_acima(linhas, n_linha)
        achados[nome] = (padrao, coment, n_linha + 1, herdado)
    return achados


def md_padrao(p):
    """O padrão pode ter várias linhas e concatenação; mostra como está."""
    p = p.strip()
    return '\n'.join(l.rstrip() for l in p.split('\n'))


def main():
    fonte = os.path.join(RAIZ, 'tools', 'extrair_boletim.py')
    regs = extrai_python(fonte)

    o = []
    w = o.append
    w('# Catálogo de expressões regulares')
    w('')
    w('> **Gerado por `tools/gerar_doc_regex.py` a partir do código.** Não edite')
    w('> este arquivo à mão: a explicação de cada entrada é o comentário que')
    w('> está acima do regex em `tools/extrair_boletim.py`. Para corrigir um')
    w('> texto daqui, corrija o comentário lá e rode o gerador de novo.')
    w('')
    w('Todo o entendimento que o portal tem do Boletim de Serviço passa por')
    w('estes padrões. O boletim é PDF corrido, sem marcação: não existe campo')
    w('"número do ato" nem "início do documento". O que existe é texto, e')
    w('estas expressões são a régua que o transforma em registro.')
    w('')
    w('Por isso mexer aqui é a operação mais arriscada do projeto. Um padrão')
    w('frouxo inventa atos que não existem; um restritivo demais apaga atos')
    w('reais, e o prejuízo só aparece meses depois, numa contagem que ninguém')
    w('conferiu. A regra da casa é **medir antes e depois, sobre uma amostra')
    w('ampla do acervo** (`dados/boletins/`), nunca só sobre o PDF que motivou')
    w('a mudança.')
    w('')

    usados = set()
    for titulo, intro, nomes in TEMAS:
        presentes = [n for n in nomes if n in regs]
        if not presentes:
            continue
        w(f'## {titulo}')
        w('')
        w(intro)
        w('')
        for nome in presentes:
            padrao, coment, linha, herdado = regs[nome]
            usados.add(nome)
            w(f'### `{nome}`')
            w('')
            w(f'`extrair_boletim.py:{linha}`')
            w('')
            if coment:
                if herdado:
                    w('*O comentário abaixo encabeça o bloco e vale também para '
                      'os padrões vizinhos.*')
                    w('')
                w('\n'.join(coment))
            else:
                w('*(sem comentário no código — escreva um lá e regenere)*')
            w('')
            w('```python')
            w(md_padrao(padrao))
            w('```')
            w('')

    faltando = [n for n in regs if n not in usados]
    if faltando:
        w('## Ainda sem tema atribuído')
        w('')
        w('Regex que existem no código e não entraram em nenhum grupo acima.')
        w('Classificar em `TEMAS`, no gerador.')
        w('')
        for nome in sorted(faltando):
            padrao, coment, linha, herdado = regs[nome]
            w(f'### `{nome}`')
            w('')
            w(f'`extrair_boletim.py:{linha}`')
            w('')
            if coment:
                w('\n'.join(coment))
            w('')
            w('```python')
            w(md_padrao(padrao))
            w('```')
            w('')

    saida = os.path.join(RAIZ, 'docs', 'REGEX.md')
    io.open(saida, 'w', encoding='utf-8', newline='\n').write('\n'.join(o))
    print(f'{len(regs)} regex lidos de extrair_boletim.py')
    print(f'  documentados por tema: {len(usados)}')
    print(f'  sem tema: {len(faltando)}' + (f' -> {faltando}' if faltando else ''))
    sem_coment = [n for n, (_, c, _, _) in regs.items() if not c]
    print(f'  sem comentario no codigo: {len(sem_coment)}'
          + (f' -> {sem_coment}' if sem_coment else ''))
    print(f'-> {saida}')


if __name__ == '__main__':
    main()
