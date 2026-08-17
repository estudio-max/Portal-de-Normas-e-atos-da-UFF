# -*- coding: utf-8 -*-
"""Diz o que deve existir na pasta `importar/` do SERVIDOR — e o que não deve.

    python tools/inventario_importar.py
    python tools/inventario_importar.py --servidor lista-do-servidor.txt

POR QUE EXISTE: a pasta `importar/` acumula. Entram bibliotecas novas, backfills
de uso único, cargas .json de dezenas de MB e scripts de diagnóstico. Nada
avisa quando um deles deixa de ser necessário, e o custo de esquecer não é
espaço em disco — é superfície. O `dump_pad_sinve.php` nasceu como diagnóstico
de uso único, ficou sem checagem de token, e por meses respondeu 200 com 4,5 MB
de texto integral de processos disciplinares para quem soubesse o nome do
arquivo, que está num repositório público.

A classificação NÃO é escrita à mão aqui: ela é derivada do próprio código —
da cadeia de `require_once` do importador, da lista branca do `.htaccess` e do
prefixo `teste_`. Lista à mão envelhece; esta não.

COM `--servidor`: recebe a listagem da pasta no servidor (um nome por linha) e
aponta o que está lá e não deveria — que é a única pergunta que este script não
consegue responder sozinho, porque o `.htaccess` nega listagem e responde 403
igual para arquivo que existe e para arquivo que não existe.
"""
import argparse
import os
import re
import sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "importar")


def requeridos_por(arquivo, vistos=None):
    """Fecho transitivo dos `require_once __DIR__` a partir de um arquivo."""
    vistos = vistos if vistos is not None else set()
    caminho = os.path.join(RAIZ, arquivo)
    if arquivo in vistos or not os.path.exists(caminho):
        return vistos
    vistos.add(arquivo)
    with open(caminho, encoding="utf-8") as f:
        for m in re.finditer(r"require_once\s+__DIR__\s*\.\s*'/([^']+)'", f.read()):
            requeridos_por(m.group(1), vistos)
    return vistos


def liberados_no_htaccess():
    """Os .php que a lista branca do .htaccess autoriza a responder por HTTP."""
    caminho = os.path.join(RAIZ, ".htaccess")
    if not os.path.exists(caminho):
        return set()
    with open(caminho, encoding="utf-8") as f:
        texto = f.read()
    m = re.search(r'FilesMatch\s+"\^\(([^)]+)\)\\\.php\$"', texto)
    return {n + ".php" for n in m.group(1).split("|")} if m else set()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--servidor", help="arquivo com a listagem da pasta no servidor")
    args = ap.parse_args()

    cron = requeridos_por("importar_v2.php")
    liberados = liberados_no_htaccess()
    # Um backfill liberado arrasta as bibliotecas que ele mesmo requer.
    for b in list(liberados):
        cron_b = requeridos_por(b)
        liberados |= cron_b

    todos = {f for f in os.listdir(RAIZ) if f.endswith(".php")}
    testes = {f for f in todos if f.startswith("teste_")}
    necessarios = (cron | liberados) - testes
    sobra = todos - necessarios - testes

    def bloco(titulo, itens, nota):
        print(f"\n{titulo} ({len(itens)})")
        print(f"  {nota}")
        for f in sorted(itens):
            print(f"    {f}")

    print("=" * 72)
    print("PASTA importar/ DO SERVIDOR — o que deve existir")
    print("=" * 72)
    bloco("FICA — cadeia do cron", sorted(cron),
          "apagar qualquer um destes quebra a importação 2x/dia, em silêncio")
    bloco("FICA — ferramentas de manutenção e o que elas requerem",
          sorted(necessarios - cron),
          "chamadas pela web com token; a lista branca do .htaccess as autoriza")
    bloco("NÃO SOBE — testes", sorted(testes),
          "rodam no CI; no servidor são só superfície exposta")
    if sobra:
        bloco("NÃO SOBE — sem uso declarado", sorted(sobra),
              "nem na cadeia do cron nem na lista branca: se está no servidor, apague")
    print("\nALÉM DOS .php, a pasta NÃO deve guardar:")
    print("    portal-data*.json e outras cargas — servem à importação e acabaram")
    print("    .sql, .md, .py, .log, .zip — material de apoio, não roda aqui")

    if args.servidor:
        with open(args.servidor, encoding="utf-8") as f:
            no_servidor = {l.strip() for l in f if l.strip()}
        print("\n" + "=" * 72)
        print("COMPARAÇÃO COM O SERVIDOR")
        print("=" * 72)
        faltando = sorted(f for f in cron if f not in no_servidor)
        if faltando:
            print("\n⚠️  FALTA no servidor (a importação vai falhar):")
            for f in faltando:
                print(f"    {f}")
        else:
            print("\n  A cadeia do cron está completa no servidor.")
        lixo = sorted(f for f in no_servidor
                      if f not in necessarios and f not in ('.htaccess',))
        if lixo:
            print(f"\n🧹 PODE APAGAR ({len(lixo)}):")
            for f in lixo:
                motivo = ("teste — pertence ao CI" if f.startswith("teste_")
                          else "carga já importada" if f.endswith(".json")
                          else "material de apoio" if f.rsplit('.', 1)[-1] in
                               ('sql', 'md', 'py', 'log', 'zip', 'txt', 'csv', 'bak')
                          else "sem uso declarado no código")
                print(f"    {f:46} {motivo}")
        else:
            print("\n  Nada sobrando.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
