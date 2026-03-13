# Payment Hub API — Setup do projeto (branch `chore/project-setup`)

Este README descreve **apenas** a base técnica do projeto: pré-requisitos, estrutura e como rodar/validar o ambiente local. Não cobre funcionalidades de negócio; outros READMEs serão criados conforme a implementação das features.

**Objetivo geral do projeto, escopo (IN/OUT) e fluxos (criar pagamento, consultar, idempotência)** estão em **[docs/requirements.md](docs/requirements.md)** — essa documentação não foi removida, apenas fica na pasta `docs/`.

---

## Branch e objetivo

| Item | Valor |
|------|--------|
| **Branch** | `chore/project-setup` |
| **Objetivo** | Base técnica para desenvolvimento local (NestJS, TypeScript, tooling, health check). |
| **Escopo** | Bootstrap, TypeScript strict, ESLint, Prettier, env, ConfigModule, scripts npm, endpoint `/health`. |

---

## Pré-requisitos

| Requisito | Versão / observação |
|-----------|---------------------|
| **Node.js** | `>= 24.0.0` ([nodejs.org](https://nodejs.org)) |
| **npm** | Incluso com Node (ou `>= 10.x`) |
| **Git** | Para clone e commits |

Verificar versões:

```bash
node -v   # v24.x.x
npm -v
```

---

## Estrutura do projeto (após o setup)

```
payment-hub-api/
├── docs/                      # Documentação (requirements, API, C4, quality, roadmap)
│   ├── api/
│   ├── c4/
│   ├── dev-commit-logs/       # Logs de commits por branch
│   └── ...
├── src/
│   ├── main.ts                # Bootstrap da aplicação NestJS
│   ├── app.module.ts          # Módulo raiz (ConfigModule, HealthModule)
│   └── health/                # Health check para validação local
│       ├── health.module.ts
│       └── health.controller.ts
├── .editorconfig              # LF, UTF-8, trim trailing whitespace
├── .env.example               # Exemplo de variáveis (PORT, NODE_ENV)
├── .eslintrc.cjs              # ESLint (TypeScript + NestJS)
├── .gitattributes             # Fins de linha LF no repositório
├── .prettierrc                # Prettier (formatação)
├── .prettierignore
├── nest-cli.json              # Nest CLI
├── package.json
├── tsconfig.json              # TypeScript (strict)
├── tsconfig.build.json
└── README.md                  # Este arquivo (setup da branch)
```

Arquivos sensíveis (não versionados): `.env` (definido a partir de `.env.example`).

---

## Configuração local

### 1. Clonar e instalar dependências

```bash
git clone <repo-url>
cd payment-hub-api
git checkout chore/project-setup
npm install
```

### 2. Variáveis de ambiente

Copiar o exemplo e ajustar se necessário:

```bash
cp .env.example .env
```

Variáveis mínimas (já documentadas em `.env.example`):

| Variável   | Uso                          | Exemplo    |
|------------|------------------------------|------------|
| `PORT`     | Porta HTTP da aplicação      | `3000`     |
| `NODE_ENV` | Ambiente (development, etc.) | `development` |

A aplicação usa `ConfigModule` (NestJS) para ler essas variáveis; não é necessário carregar `.env` manualmente.

---

## Scripts npm

| Script        | Comando                    | Uso                          |
|---------------|----------------------------|------------------------------|
| `npm run build`   | `nest build`           | Compila para `dist/`         |
| `npm run start`   | `nest start`           | Inicia a aplicação           |
| `npm run start:dev`| `nest start --watch`   | Desenvolvimento com watch    |
| `npm run start:debug` | `nest start --debug --watch` | Debug com watch  |
| `npm run start:prod` | `node dist/main`     | Produção (rodar após build)  |
| `npm run lint`     | ESLint com fix          | Lint em `src/`, `test/`      |
| `npm run format`   | Prettier                | Formatação de código         |

---

## Validação do ambiente

1. **Build**

   ```bash
   npm run build
   ```
   Deve gerar a pasta `dist/` sem erros.

2. **Subir em modo desenvolvimento**

   ```bash
   npm run start:dev
   ```

3. **Health check**

   Com a aplicação rodando (porta padrão `3000` ou a definida em `PORT`):

   ```bash
   curl http://localhost:3000/health
   ```
   Resposta esperada: `200 OK` e corpo `{ "status": "ok" }`.

4. **Lint e formatação**

   ```bash
   npm run lint
   npm run format
   ```

---

## Detalhes técnicos (esta branch)

### TypeScript

- **tsconfig.json**: `strict: true`, `noImplicitAny: true`, `rootDir: "./src"`, `outDir: "./dist"`.
- **tsconfig.build.json**: Estende o principal e exclui testes para o build de produção.

### ESLint

- Parser e plugins: TypeScript e NestJS (`.eslintrc.cjs`).
- Integração com Prettier (`plugin:prettier/recommended`).
- Regras: `no-explicit-any: warn`, `no-unused-vars: error`.

### Prettier

- Configuração em `.prettierrc`: single quotes, trailing commas, `printWidth: 100`, `tabWidth: 2`, `semi: true`.

### ConfigModule

- `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] })` em `AppModule`.
- Leitura de configuração via `ConfigService` (ex.: `PORT` em `main.ts`).

### Fins de linha

- Repositório padronizado em **LF** (`.gitattributes`: `* text=auto eol=lf`).
- `.editorconfig` define `end_of_line = lf` para o editor. Em caso de avisos no Windows, ver `docs/LINE-ENDINGS.md`.

---

## Documentação adicional

- **Objetivo, escopo IN/OUT e fluxos detalhados**: [docs/requirements.md](docs/requirements.md) (fonte da verdade).
- **API e arquitetura**: [docs/api/openapi.md](docs/api/openapi.md), [docs/c4/](docs/c4/), [docs/quality.md](docs/quality.md), [docs/roadmap.md](docs/roadmap.md).
- **Commits desta branch**: `docs/dev-commit-logs/project-setup.md` e `docs/dev-commit-logs/project-setup-commands.md`.
- **Fins de linha no Windows**: `docs/LINE-ENDINGS.md`.
