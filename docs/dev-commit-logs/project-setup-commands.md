# Comandos Git — chore/project-setup

Execute na raiz do repositório, na branch `chore/project-setup`.

---

## Melhor prática recomendada

### Princípios Git aplicados

| Princípio | Aplicação |
|-----------|-----------|
| **Commits atômicos** | Cada commit = uma mudança lógica. Facilita `git revert`, `git bisect` e code review. |
| **Histórico legível** | Mensagens no formato Conventional Commits (`chore(escopo): descrição`) e ordem que conta uma história coerente. |
| **Projeto sempre buildável** | Após cada commit (ou após blocos críticos), o projeto deve continuar compilando/rodando quando fizer sentido. |
| **Sem reutilizar o mesmo arquivo em vários commits sem nova alteração** | Evitar commits 6 e 7 que só re-adicionam arquivos já commitados no 1, sem mudança real. |

### Estratégia recomendada: rodar um por um, na ordem

**Sim.** A melhor prática é rodar **um commit por vez, na ordem 1 → 9**, desde que:

1. **Cada comando seja executado separadamente** — você vê o resultado de cada commit e pode revisar com `git log -1 --stat`.
2. **Não haja sobreposição inútil** — como hoje tudo foi criado de uma vez, os commits 6 (config) e 7 (scripts) reutilizam arquivos já commitados no 1. Nesse caso, use a **sequência sem sobreposição** abaixo (7 commits atômicos + 1 de docs).
3. **Validação entre commits (opcional mas recomendado)** — após commits que alteram build/runtime (ex.: após 1 e após 8), rodar `npm run build` ou `npm run start:dev` para garantir que nada quebrou.

### Sequência recomendada (sem arquivo em dois commits)

Para o estado atual do repositório (todos os arquivos já criados), a melhor prática é uma **sequência de 7 commits atômicos + 1 de documentação**, em que cada arquivo entra em **um único** commit:

```
1. Bootstrap (app + package + nest-cli)
2. TypeScript
3. ESLint
4. Prettier
5. Env example
6. Health
7. Docs
```

Assim você mantém commits atômicos, histórico limpo e nenhum “commit vazio” (arquivo já commitado).

---

## Comandos — um por um (melhor prática)

Use a sequência abaixo. Rode **um bloco por vez**, confira com `git log -1 --stat` e, se quiser, valide com `npm run build` após o commit 1 e após o commit 6.

```bash
# 1. Bootstrap (NestJS + package + main/app)
git add package.json nest-cli.json src/main.ts src/app.module.ts
git commit -m "chore(project-bootstrap): bootstrap nestjs project with node 24 and npm"

# 2. TypeScript strict
git add tsconfig.json tsconfig.build.json
git commit -m "chore(tooling): configure typescript strict mode"

# 3. ESLint
git add .eslintrc.cjs
git commit -m "chore(lint): configure eslint for typescript and nestjs"

# 4. Prettier
git add .prettierrc .prettierignore
git commit -m "chore(format): configure prettier formatting rules"

# 5. Env example
git add .env.example
git commit -m "chore(env): add dotenv configuration and env example"

# 6. Health check
git add src/health/
git commit -m "chore(health): add health endpoint for local verification"

# 7. Docs (commit log + comandos)
git add docs/dev-commit-logs/project-setup.md docs/dev-commit-logs/project-setup-commands.md
git commit -m "docs(project-setup): add dev commit log and git commands"
```

**Checklist ao rodar um por um**

- [ ] Estar na branch `chore/project-setup`.
- [ ] Working tree limpo (`git status`) antes de começar.
- [ ] Rodar um `git add` + `git commit` por vez.
- [ ] Opcional: após commit 1, rodar `npm run build`; após commit 6, rodar `npm run start:dev` e testar `GET /health`.

---

## Referência — commits numerados (plano original 1–9)

Se no futuro você fizer o setup **passo a passo** (bootstrap mínimo no 1, depois adicionar config no 6 e scripts no 7), pode usar a numeração completa abaixo.

### 1. Bootstrap NestJS

```bash
git add package.json nest-cli.json src/main.ts src/app.module.ts
git commit -m "chore(project-bootstrap): bootstrap nestjs project with node 24 and npm"
```

## 2. TypeScript strict

```bash
git add tsconfig.json tsconfig.build.json
git commit -m "chore(tooling): configure typescript strict mode"
```

## 3. ESLint

```bash
git add .eslintrc.cjs
git commit -m "chore(lint): configure eslint for typescript and nestjs"
```

## 4. Prettier

```bash
git add .prettierrc .prettierignore
git commit -m "chore(format): configure prettier formatting rules"
```

## 5. Variáveis de ambiente

```bash
git add .env.example
git commit -m "chore(env): add dotenv configuration and env example"
```

## 6. ConfigModule

```bash
git add src/main.ts src/app.module.ts
git commit -m "chore(config): add nestjs config module for environment variables"
```

## 7. Scripts npm

```bash
git add package.json
git commit -m "chore(scripts): add npm scripts for build start and lint"
```

## 8. Health check

```bash
git add src/health/
git commit -m "chore(health): add health endpoint for local verification"
```

## 9. DEV Commit Log (opcional)

```bash
git add docs/dev-commit-logs/project-setup.md docs/dev-commit-logs/project-setup-commands.md
git commit -m "docs(project-setup): add dev commit log and git commands"
```

---

## Executar todos de uma vez (já com arquivos prontos)

**Opção A** — É a mesma sequência da seção **“Comandos — um por um (melhor prática)”** acima (7 commits). Pode colar o bloco inteiro; o ideal ainda é rodar um commit por vez para revisar.

**Opção B — Commit único da branch** (aceitável se a equipe tratar “setup inicial” como uma única entrega):

```bash
git add package.json nest-cli.json tsconfig.json tsconfig.build.json .eslintrc.cjs .prettierrc .prettierignore .env.example src/
git add docs/dev-commit-logs/project-setup.md docs/dev-commit-logs/project-setup-commands.md
git commit -m "chore(project-setup): bootstrap nestjs with node 24, tooling, env, config and health"
```
