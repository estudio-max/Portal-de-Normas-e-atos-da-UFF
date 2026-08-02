# Correção da navegação do redesign — Plano de implementação

> **Para execução:** aplicar em linha, com testes de regressão antes de cada alteração de produção.

**Objetivo:** Fazer com que cada item de navegação do redesign abra um painel compatível com os modos API e estático, sem hashes inválidos.

**Arquitetura:** `App.tsx` permanece como o ponto único de roteamento por hash. A rota de atos usa a tabela de leitura já compatível com a camada de dados; a de relações escolhe o painel adequado ao modo de dados. A navegação do Dashboard não cria rotas de detalhe ainda não implementadas.

**Restrições:** React 19, Vite, Tailwind v4; sem mudança de API PHP, banco, dependências ou formato de URL público além de impedir rotas inválidas.

---

### Tarefa 1: Proteger as rotas de consulta

**Arquivos:**

- Modificar: `src/App.tsx`
- Modificar: `tools/test_redesign_integrity.mjs`

- [ ] Escrever asserções de regressão para a rota `atos`, para a seleção API/estática de relações e para a ausência de links `atos/:id` não implementados.
- [ ] Executar `node tools/test_redesign_integrity.mjs` e confirmar a falha nas asserções novas.
- [ ] Alterar o roteador para usar `ActTable` em `atos` e `ActRelationsApi` ou `ActRelationships` conforme `apiMode`.
- [ ] Alterar os cards recentes para navegar para a lista de atos enquanto não existir uma tela de detalhe endereçável.
- [ ] Executar novamente o teste de integridade e confirmar sucesso.

### Tarefa 2: Completar a navegação compacta

**Arquivos:**

- Modificar: `src/components/layout/Sidebar.tsx`
- Modificar: `tools/test_redesign_integrity.mjs`

- [ ] Escrever asserção de que a sidebar compacta também renderiza os itens do rodapé.
- [ ] Executar o teste e confirmar falha.
- [ ] Renderizar os itens de rodapé na sidebar compacta, preservando ícones, título acessível e o mesmo callback de navegação.
- [ ] Executar o teste de integridade e confirmar sucesso.

### Tarefa 3: Validar e documentar a entrega

**Arquivos:**

- Criar: `docs/IMPLEMENTACAO-REDESIGN.md`

- [ ] Executar `npm run lint`, `npm run build` e `node tools/test_redesign_integrity.mjs`.
- [ ] Documentar diagnóstico, alterações, comportamento de fallback, roteiro de teste manual e os arquivos a incluir no commit.
