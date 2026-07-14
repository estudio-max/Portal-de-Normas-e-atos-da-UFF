# -*- coding: utf-8 -*-
"""Regressao da extracao de mandato (prazo/inicio) das designacoes de chefia.

    python teste_mandato.py

Casos vindos de atos REAIS do Boletim de Servico. Os negativos existem porque
cada um ja foi (ou quase foi) um bug: 'mandato de 6 (seis) meses' virou 72
meses na primeira versao, e 'pelo prazo de 03 (tres) anos' de uma licenca e o
tipo de texto que uma ancoragem frouxa importaria como se fosse mandato.
"""
import sys
import extrair_boletim as E

SIAPE = "1335488"   # matricula real: o extrator so aceita SIAPE de verdade

CASOS = [
    # (nome, texto, data_ato, prazo_meses, data_inicio, origem)
    ("a partir de + mandato 4a",
     "Art. 1o - Designar, a partir de 30/03/2026, EDUARDO DA SILVA FERNANDES, Professor do "
     "Magisterio Superior, matricula SIAPE no. 1335488, do Quadro Permanente da Universidade, "
     "para exercer, com mandato de 04 (quatro) anos, a funcao de Vice-Coordenador do Curso de "
     "Graduacao em Administracao, do Instituto de Ciencias Humanas e Sociais.",
     "2026-04-10", 48, "2026-03-30", "declarado"),

    ("sem 'a partir de' -> data do ato",
     "Art. 1o - Designar CARLOS FREDERICO BOM KRAEMER, Professor do Magisterio Superior, "
     "matricula SIAPE no. 1766040, do Quadro Permanente da Universidade, para exercer, com "
     "mandato de 04 (quatro) anos, a funcao de Coordenador do Curso de Graduacao em "
     "Administracao Publica - modalidade a distancia, do Instituto de Ciencias Humanas e Sociais.",
     "2026-04-10", 48, "2026-04-10", "data_ato"),

    ("mandato de 2 anos",
     "Art. 1o - Designar, a partir de 29/04/2025, LORENA RODRIGUES TAVARES DE FREITAS, Professor "
     "do Magisterio Superior, matricula SIAPE no. 1141638, pertencente ao Quadro Permanente da "
     "Universidade, para exercer, com mandato de 2 (dois) anos, a funcao de Subchefe do "
     "Departamento de Ciencia Politica, do Instituto de Ciencias Humanas e Filosofia.",
     "2025-05-15", 24, "2025-04-29", "declarado"),

    # O relogio do tampao comeca com o ANTECESSOR. Somar o prazo a data deste
    # ato daria ao substituto um mandato novo em folha (aqui: +2 anos a mais).
    ("tampao: 'iniciado em' manda",
     "Designar JOSE DA SILVA, matricula SIAPE no 1306356, para exercer a funcao de Coordenador "
     "do Curso de Pedagogia, subordinado ao Centro de Estudos Sociais Aplicados, complementando "
     "assim, o mandato de 04 (quatro) anos, iniciado em 29 de abril de 2003, atraves da portaria "
     "no 31.206, de 25.04.2003.",
     "2005-06-01", 48, "2003-04-29", "tampao"),

    ("tampao sem a palavra 'anos' (legado)",
     "Designar PEDRO ROCHA, matricula SIAPE no 1306356, para exercer a funcao de Coordenador do "
     "Curso de Pedagogia, complementando assim, o mandato de 04 (quatro), iniciado em 06 de "
     "agosto de 2002, atraves da portaria no 30.289.",
     "2004-01-15", 48, "2002-08-06", "tampao"),

    ("mandato em MESES nao vira anos",
     "Designar MARIA SOUZA, matricula SIAPE no 1766040, para exercer, com mandato de 6 (seis) "
     "meses, a funcao de Chefe do Departamento de Artes.",
     "2025-06-10", 6, "2025-06-10", "data_ato"),

    # Ancoragem: o ato cita DOIS prazos; so o do mandato vale.
    ("ancora em 'mandato', ignora prazo de licenca",
     "Designar ANA LIMA, matricula SIAPE no 1141638, ora em licenca pelo prazo de 03 (tres) anos, "
     "para exercer, com mandato de 2 (dois) anos, a funcao de Subchefe do Departamento de Fisica.",
     "2025-06-10", 24, "2025-06-10", "data_ato"),

    ("designacao sem prazo declarado (41% do legado)",
     "Designar ANA PAULA LIMA, matricula SIAPE no 1112233, para exercer a funcao de Chefe do "
     "Departamento de Quimica, do Instituto de Quimica.",
     "2024-03-01", None, "2024-03-01", "data_ato"),

    # Data fora de faixa e erro de captura (OCR, 'a partir de' de outra coisa).
    ("guarda: data absurda cai pra data do ato",
     "Designar, a partir de 30/03/1974, JOAO DA SILVA, matricula SIAPE no 1335488, para exercer, "
     "com mandato de 04 (quatro) anos, a funcao de Chefe do Departamento de Artes.",
     "2025-06-10", 48, "2025-06-10", "data_ato"),

    # Dispensa encerra o mandato de outro ato; nao abre um.
    ("dispensa nao carrega mandato",
     "Dispensar JOAO PEREIRA, matricula SIAPE no 1582685, da funcao de Chefe do Departamento de "
     "Fisica, com mandato de 04 (quatro) anos.",
     "2024-03-01", None, "", ""),
]


def main():
    falhas = 0
    print(f"{'caso':44} {'prazo':>6} {'inicio':12} {'origem':10} ok")
    print("-" * 84)
    for nome, txt, da, p_esp, i_esp, o_esp in CASOS:
        fs = E.extrai_funcoes(txt, da)
        if not fs:
            print(f"{nome:44} {'-- nada extraido --':>32} FALHOU")
            falhas += 1
            continue
        f = fs[0]
        ok = (f["prazo_meses"] == p_esp and f["data_inicio"] == i_esp
              and f["inicio_origem"] == o_esp)
        falhas += not ok
        print(f"{nome:44} {str(f['prazo_meses']):>6} {f['data_inicio'] or '-':12} "
              f"{f['inicio_origem'] or '-':10} {'OK' if ok else 'FALHOU'}")
        if not ok:
            print(f"{'':44} esperado: {str(p_esp):>6} {i_esp or '-':12} {o_esp or '-':10}")
    print("-" * 84)
    print(f"{len(CASOS)-falhas}/{len(CASOS)} OK" if not falhas else f"{falhas} FALHA(S)")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
