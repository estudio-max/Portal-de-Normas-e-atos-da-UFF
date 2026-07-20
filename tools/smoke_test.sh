#!/usr/bin/env bash
# Smoke test pós-deploy do Portal de Normas (bash + curl + python3).
#
#   ./tools/smoke_test.sh                          # produção
#   ./tools/smoke_test.sh https://outra-url.uff.br # outra base (migração)
#
# Deploy só está PRONTO quando tudo aqui passa — cobre exatamente os dois
# acidentes que já aconteceram de verdade: (a) subir a API com nome errado
# deixa o portal caindo pro modo estático sem avisar; (b) subir dist/ novo com
# api/index.php velho quebra o painel novo com "precisa da versão mais
# recente" (agora o health denuncia a versão que está rodando).
set -u
BASE="${1:-https://inteligencia.fanara.com.br}"
FALHAS=0

diga() { printf '%-46s %s\n' "$1" "$2"; }

checa_json() {  # rota, expressão python sobre `d` que deve ser verdadeira
    local rota="$1" cond="$2"
    local corpo code
    corpo=$(curl -sL --max-time 30 "$BASE$rota")
    code=$?
    if [ $code -ne 0 ] || [ -z "$corpo" ]; then
        diga "$rota" "FALHOU (sem resposta, curl=$code)"; FALHAS=$((FALHAS+1)); return 1
    fi
    if printf '%s' "$corpo" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
sys.exit(0 if ($cond) else 1)
"; then
        diga "$rota" "ok"
    else
        diga "$rota" "FALHOU (JSON inesperado: $(printf '%s' "$corpo" | head -c 90)…)"
        FALHAS=$((FALHAS+1)); return 1
    fi
}

echo "== Smoke test: $BASE =="

# 1) health: no ar e com versão identificável
VERSAO=$(curl -sL --max-time 30 "$BASE/api/health" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('api_versao', '?') if d.get('ok') else '')
except Exception:
    print('')")
if [ -n "$VERSAO" ]; then
    diga "/api/health" "ok (api_versao=$VERSAO)"
else
    diga "/api/health" "FALHOU"; FALHAS=$((FALHAS+1))
fi

# 2) rotas principais respondem com a forma esperada
checa_json "/api/stats"                "d.get('total', 0) > 0"
checa_json "/api/atos?por_pagina=1"    "isinstance(d.get('atos'), list) and len(d['atos']) == 1"
checa_json "/api/jornada"              "'flex' in d and 'pgd' in d"
checa_json "/api/cooperacao"           "isinstance(d.get('acordos'), list) and len(d['acordos']) > 0"
checa_json "/api/prazos"               "isinstance(d, (list, dict))"

# 3) ficha por PATH_INFO (o roteamento /api/atos/{id} — quebra silenciosa
#    clássica quando .htaccess/rewrite não subiu junto).
#    ATO_UID, não UID: UID é variável READONLY do bash (id do usuário) e
#    atribuí-la falha silenciosamente deixando o valor antigo (bug real da
#    1ª rodada deste script: consultou /api/atos/197609).
ATO_UID=$(curl -sL --max-time 30 "$BASE/api/atos?por_pagina=1" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin)['atos'][0]['id'])
except Exception:
    print('')")
if [ -n "$ATO_UID" ]; then
    checa_json "/api/atos/$ATO_UID" "d.get('id') == '$ATO_UID'"
else
    diga "/api/atos/{id}" "PULADO (não obtive uid na listagem)"; FALHAS=$((FALHAS+1))
fi

# 4) dossiê valida entrada (400 sem siape = rota viva e validando)
CODE=$(curl -sL --max-time 30 -o /dev/null -w '%{http_code}' "$BASE/api/dossie")
if [ "$CODE" = "400" ]; then
    diga "/api/dossie (sem siape)" "ok (400 esperado)"
else
    diga "/api/dossie (sem siape)" "FALHOU (esperava 400, veio $CODE)"; FALHAS=$((FALHAS+1))
fi

# 5) config.php tem que estar BLOQUEADO
CODE=$(curl -sL --max-time 30 -o /dev/null -w '%{http_code}' "$BASE/api/config.php")
if [ "$CODE" != "200" ]; then
    diga "/api/config.php bloqueado" "ok ($CODE)"
else
    diga "/api/config.php bloqueado" "FALHOU — credenciais expostas! (200)"; FALHAS=$((FALHAS+1))
fi

echo
if [ $FALHAS -eq 0 ]; then
    echo "TUDO OK — deploy validado."
else
    echo "$FALHAS FALHA(S) — deploy NÃO está pronto."
    exit 1
fi
