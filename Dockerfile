# Portal de Normas e Atos — UFF  |  imagem para Google Cloud Run
# Build em dois estágios: compila o app (Vite) e serve os estáticos.

# --- Estágio 1: build ---------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

# --- Estágio 2: runtime (somente estáticos + servidor mínimo) -----------------
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/dist ./dist
COPY serve.cjs ./
EXPOSE 8080
CMD ["node", "serve.cjs"]
