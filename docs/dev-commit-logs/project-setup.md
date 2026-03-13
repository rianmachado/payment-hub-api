# DEV COMMIT LOG — chore/project-setup

## Branch

**Nome:** `chore/project-setup`

## Objetivo da branch

Entregar uma base técnica profissional para desenvolvimento local do Payment Hub API, sem implementar funcionalidades de negócio. A documentação arquitetural em `docs/` é a fonte da verdade.

## Escopo

- Node.js 24, npm
- NestJS, TypeScript, Nest CLI
- ESLint, Prettier
- Variáveis de ambiente (.env, .env.example)
- ConfigModule (NestJS) para configuração centralizada
- Build local, start, start:dev
- Health check (GET /health) para validação local

**Fora do escopo:** módulos de domínio, DTOs, controllers de pagamento, serviços de pagamento, guards/interceptors/filters de negócio.

---

## Lista ordenada dos commits

1. **chore(project-bootstrap): bootstrap nestjs project with node 24 and npm**
   - Criação do projeto NestJS com npm.
   - package.json com engines Node >= 24, dependências @nestjs/core, @nestjs/common, @nestjs/platform-express, @nestjs/config.
   - Estrutura inicial: src/main.ts, src/app.module.ts, nest-cli.json.

2. **chore(tooling): configure typescript strict mode**
   - tsconfig.json com strict: true, noImplicitAny: true, rootDir/outDir coerentes.
   - tsconfig.build.json estendendo tsconfig.json para build de produção.

3. **chore(lint): configure eslint for typescript and nestjs**
   - .eslintrc.cjs com parser TypeScript, plugins @typescript-eslint e @nestjs/eslint-plugin.
   - Regras básicas de qualidade e integração com Prettier.

4. **chore(format): configure prettier formatting rules**
   - .prettierrc (singleQuote, trailingComma, printWidth, tabWidth, semi).
   - .prettierignore para dist, node_modules, coverage.

5. **chore(env): add dotenv configuration and env example**
   - .env e .env.example com variáveis mínimas: PORT, NODE_ENV.
   - Uso por ConfigModule (carregamento via @nestjs/config).

6. **chore(config): add nestjs config module for environment variables**
   - ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }) em AppModule.
   - main.ts usando ConfigService para obter PORT.

7. **chore(scripts): add npm scripts for build start and lint**
   - Scripts: build, start, start:dev, start:debug, start:prod, lint, format.

8. **chore(health): add health endpoint for local verification**
   - HealthModule com HealthController.
   - GET /health retornando { status: 'ok' }.

---

## Critérios de validação final da branch

- [ ] `npm install` executa sem erros.
- [ ] `npm run build` gera saída em `dist/` sem erros de TypeScript.
- [ ] `npm run start:dev` sobe a aplicação e mantém watch ativo.
- [ ] `GET http://localhost:3000/health` retorna `200` e `{ "status": "ok" }` (ou porta definida em PORT).
- [ ] `npm run lint` executa sem erros (ou apenas avisos aceitos).
- [ ] `npm run format` formata o código conforme Prettier.
- [ ] Variáveis PORT e NODE_ENV lidas via ConfigService; .env.example documenta variáveis mínimas.
