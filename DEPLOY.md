# Deploy do Portal de Normas e Atos — UFF

O app é um site **estático** (não precisa mais de backend nem de chave Gemini —
o "Assistente de Indexação" roda no próprio navegador). Qualquer host estático
serve. Abaixo, do mais alinhado ao que você já usa (Cloud Run) ao mais simples.

---

## Opção A — Google Cloud Run (mesma plataforma de antes)

Pré-requisitos: ter o [gcloud CLI](https://cloud.google.com/sdk/docs/install)
instalado e logado (`gcloud auth login`). Use o projeto que já hospeda o app
(o número que aparece na URL atual é `733190582475`).

Na pasta `app-fonte`:

```bash
# 1. selecionar o projeto (troque pelo ID do seu projeto, se diferente)
gcloud config set project SEU_PROJECT_ID

# 2. fazer o build da imagem (usa o Dockerfile) e publicar — tudo em um comando
gcloud run deploy portal-de-normas-e-atos-uff \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --port 8080
```

O `gcloud run deploy --source .` lê o `Dockerfile`, compila o app, sobe a imagem
e publica. Ao terminar, ele imprime a URL pública (a mesma de antes, se mantiver
o nome do serviço `portal-de-normas-e-atos-uff`).

> Atualização dos dados: a imagem leva o `portal-data.json` "congelado" no
> momento do build. Para refletir novos boletins, rode o comando de deploy de
> novo (a rotina diária local regenera o `portal-data.json`; o deploy publica a
> versão mais recente). Se quiser atualização automática diária no ar, dá para
> agendar um redeploy — me avise.

---

## Opção B — Atualizar pelo GitHub + Google AI Studio (como você fez antes)

Se o serviço do Cloud Run está ligado ao repositório
`estudio-max/Portal-de-Normas-e-atos-da-UFF` via AI Studio, basta **enviar o
código atualizado** para o repositório que o redeploy acontece pelo fluxo do
AI Studio. O conteúdo atualizado está nesta pasta `app-fonte/`. (Posso te ajudar
a montar o `git push`, mas isso publica no seu repositório — confirma antes.)

---

## Opção C — Host estático simples (Netlify / Vercel / GitHub Pages)

Não precisa de Docker. Basta publicar a pasta já compilada `../app/`
(index.html + assets + portal-data.json). Exemplos:

- **Netlify (drag-and-drop):** arraste a pasta `app/` em https://app.netlify.com/drop
- **Netlify CLI:** `netlify deploy --dir ../app --prod`
- **Vercel:** `vercel deploy ../app --prod`
- **GitHub Pages:** suba o conteúdo de `app/` num branch `gh-pages`.

---

## Testar localmente antes de publicar

```bash
# servir a pasta já compilada:
python -m http.server 8080 --directory ../app
# ou, simulando o container:
npm ci && npx vite build && PORT=8080 node serve.cjs
```
Acesse `http://localhost:8080`.
