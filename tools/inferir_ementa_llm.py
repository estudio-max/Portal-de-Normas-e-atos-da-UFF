# -*- coding: utf-8 -*-
"""
Fallback LLM (Claude Haiku) para os ~6% de atos SEM ementa formal em que a
síntese DETERMINÍSTICA (sintetiza_ementa, no extrair_boletim.py) não achou um
dispositivo reconhecível. É a 2ª metade do modo HÍBRIDO: o determinístico cobre
~94%; este script resume o resto.

O que faz: para cada ato com ementa oficial vazia E ementa_inferida=False,
manda o corpo do ato ao Haiku e pede UMA frase de ementa, impessoal, fiel ao
texto (sem inventar). Grava em ementa_resumo + ementa_inferida=True no atos.json.
Depois é só rodar de novo gerar_dados_portal.py + gerar_sql.py.

Uso:
    export ANTHROPIC_API_KEY=sk-ant-...        # ou `ant auth login`
    pip install anthropic
    python tools/inferir_ementa_llm.py out_2025/atos.json          # 1 ano
    python tools/inferir_ementa_llm.py out_2023/atos.json out_2024/atos.json ...
    python tools/inferir_ementa_llm.py --dry-run out_2025/atos.json  # só mostra, não grava

Custo: Haiku 4.5 ~US$1/1M tokens de entrada. ~350 atos ⇒ centavos.
"""
import sys, os, json, argparse, time, concurrent.futures as cf

MODELO = "claude-haiku-4-5"   # barato e rápido p/ sumarização; NÃO troque sem pedir
MAX_WORKERS = 5               # paralelismo gentil (respeita rate limit)

SYSTEM = (
    "Você indexa atos administrativos da Universidade Federal Fluminense (UFF). "
    "Dado o TEXTO de um ato sem ementa oficial, escreva UMA ementa curta em "
    "português, impessoal e em 3ª pessoa (ex.: 'Designa...', 'Concede...', "
    "'Institui a Comissão de...'), no estilo das ementas oficiais. "
    "Regras: NÃO invente fatos — resuma só o que está no texto; sem preâmbulo, "
    "sem aspas; no máximo ~200 caracteres; devolva APENAS a ementa."
)


def _residuais(atos):
    for a in atos:
        if len((a.get("ementa") or "").strip()) < 12 and not a.get("ementa_inferida"):
            if (a.get("corpo_busca") or "").strip():
                yield a


def _resumir(client, ato):
    """Chama o Haiku para 1 ato. Retorna (id_idx, texto|'')."""
    import anthropic
    corpo = (ato.get("corpo_busca") or "")[:4000]
    for tentativa in range(4):
        try:
            resp = client.messages.create(
                model=MODELO, max_tokens=160, system=SYSTEM,
                messages=[{"role": "user", "content":
                           "TEXTO DO ATO:\n" + corpo + "\n\nEmenta:"}],
            )
            if resp.stop_reason == "refusal":       # raríssimo p/ este conteúdo
                return ""
            txt = "".join(b.text for b in resp.content if b.type == "text").strip()
            return txt.strip(' "').rstrip(".") + "." if txt else ""
        except anthropic.RateLimitError:
            time.sleep(2 * (tentativa + 1))
        except anthropic.APIError as e:
            if getattr(e, "status_code", 500) >= 500 and tentativa < 3:
                time.sleep(2 * (tentativa + 1)); continue
            raise
    return ""


def processar(caminho, client, dry_run=False):
    base = json.load(open(caminho, encoding="utf-8"))
    atos = base["atos"] if isinstance(base, dict) and "atos" in base else base
    alvo = list(_residuais(atos))
    print(f"{caminho}: {len(alvo)} atos residuais p/ o LLM")
    if not alvo:
        return 0
    feitos = 0
    with cf.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        fut = {ex.submit(_resumir, client, a): a for a in alvo}
        for f in cf.as_completed(fut):
            a = fut[f]
            resumo = f.result()
            if resumo:
                if dry_run:
                    print(f"  [{a.get('identificador')}] {resumo}")
                else:
                    a["ementa_resumo"] = resumo
                    a["ementa_inferida"] = True
                feitos += 1
    if not dry_run and feitos:
        json.dump(base, open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  -> {feitos} ementas geradas{' (dry-run, nada gravado)' if dry_run else ''}")
    return feitos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("arquivos", nargs="+", help="out_YYYY/atos.json a completar")
    ap.add_argument("--dry-run", action="store_true", help="mostra sem gravar")
    args = ap.parse_args()
    try:
        from anthropic import Anthropic
    except ImportError:
        sys.exit("Instale o SDK: pip install anthropic")
    client = Anthropic()   # usa ANTHROPIC_API_KEY do ambiente ou perfil `ant auth login`
    total = sum(processar(c, client, args.dry_run) for c in args.arquivos)
    print(f"\nTotal: {total} ementas inferidas por LLM.")
    if not args.dry_run and total:
        print("Agora rode de novo: gerar_dados_portal.py + gerar_sql.py p/ esses anos.")


if __name__ == "__main__":
    main()
