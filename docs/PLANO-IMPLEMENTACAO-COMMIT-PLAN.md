# Plano profissional de implementação guiada por commits

**Branch:** `planning/implementation-commit-plan`  
**Projeto:** Payment Hub API  
**Fonte de verdade:** `docs/` (requirements, openapi, data-state, c4, quality, roadmap, INTEGRATION-REVIEW)

---

## 1. Estratégia de implementação

A ordem **modules → dto → idempotency → payment-service → controller → exception-filters → interceptors → guards** é a mais segura e consistente para NestJS pelos seguintes motivos:

1. **Modules primeiro:** O NestJS é orientado a módulos; sem a estrutura de módulos (App, Config, Auth, Payments, Transactions, Idempotency, Providers, Shared, Persistence, Cache, Health) não há onde injetar serviços nem onde registrar controllers, filters e guards. Garante injeção de dependência e boundaries claros desde o início.

2. **DTO antes de serviços de negócio:** Contratos de entrada/saída e validação (DTO + ValidationPipe + Pipes/Middlewares) estabilizam a fronteira da API. Idempotency e PaymentService passam a trabalhar com tipos bem definidos e validação já aplicada na borda, reduzindo erros e retrabalho.

3. **Idempotency antes do PaymentService:** O fluxo de criação de pagamento (requirements e C4) exige que o PaymentsService consulte o IdempotencyService antes de criar o pagamento. Implementar idempotência antes da orquestração evita acoplamento invertido e permite testar replay/conflito de forma isolada.

4. **PaymentService antes do Controller:** O controller deve ser fino: receber DTO, delegar ao serviço, mapear resposta. Ter o PaymentsService pronto (incluindo integração com Idempotency, Transactions, Providers) permite expor o controller apenas como camada HTTP, sem lógica de negócio.

5. **Controller antes de Filters/Interceptors/Guards:** Com os endpoints expostos, aplicam-se em sequência: (a) **Exception Filters** para padronizar erros em todas as rotas; (b) **Interceptors** para logging, correlation-id e métricas; (c) **Guards** para autenticação/autorização. Filters e Interceptors não dependem de Guards; Guards dependem do controller existente para serem aplicados. Essa ordem evita duplicar configuração e garante que erros de auth também passem pelo formato padronizado e pelo logging.

6. **Cross-cutting por último:** Exception Filters, Interceptors e Guards são cross-cutting; aplicá-los após a lógica de negócio e HTTP estar pronta permite validar o comportamento completo (sucesso e falha) com tratamento de erro e observabilidade já unificados.

---

## 2. Plano profissional de implementação (por commit)

### Commit 1 — feat(modules): scaffold core application modules

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Estabelecer a estrutura de módulos NestJS sem lógica de negócio. |
| **Escopo** | AppModule importando ConfigModule, AuthModule, PaymentsModule, TransactionsModule, IdempotencyModule, ProvidersModule, SharedModule (ou ObservabilityModule), PersistenceModule (ou DatabaseModule), CacheModule (ou IdempotencyStoreModule), HealthModule. Exports mínimos; nenhum módulo "Deus". |
| **Arquivos/pastas prováveis** | `src/app.module.ts`, `src/config/`, `src/auth/`, `src/payments/`, `src/transactions/`, `src/idempotency/`, `src/providers/`, `src/shared/` ou `src/observability/`, `src/persistence/` ou `src/database/`, `src/cache/`, `src/health/`. |
| **Dependências** | Nenhum. |
| **Referência documental** | `docs/c4/container.md` (C2), `docs/c4/components.md` (M1–M10), `docs/quality.md` (§ 3.1). |

---

### Commit 2 — feat(dto): implement api contracts and validation layer

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Contratos de API e camada de validação para criação e consulta de pagamento. |
| **Escopo** | DTOs request/response alinhados ao OpenAPI; ValidationPipe global; validações declarativas; Pipes de transformação; Middlewares para X-Correlation-Id e logging. |
| **Arquivos/pastas prováveis** | `src/payments/dto/`, `src/shared/dto/`, `src/common/pipes/`, `src/common/middleware/`, configuração em `main.ts` ou AppModule. |
| **Dependências** | Commit 1 (modules). |
| **Referência documental** | `docs/requirements.md`, `docs/api/openapi.md`, `docs/quality.md` (§ 3.2). |

---

### Commit 3 — feat(idempotency): implement idempotency module and key validation

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Módulo de idempotência com verificação de chave, replay compatível e conflito. |
| **Escopo** | IdempotencyService: first call / replay compatível / conflito; storage (DB/cache); validação de Idempotency-Key (presença, máx. 128 caracteres). |
| **Arquivos/pastas prováveis** | `src/idempotency/idempotency.service.ts`, `src/idempotency/idempotency.module.ts`, `src/idempotency/storage/`. |
| **Dependências** | Commit 1; eventualmente persistência (entidades/repositórios) se já existir. |
| **Referência documental** | `docs/requirements.md`, `docs/data-state.md`, `docs/c4/components.md` (M5), `docs/quality.md` (§ 3.4, § 4.1, § 4.3). |

---

### Commit 4 — feat(payment-service): implement payment orchestration service

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Serviço de orquestração de criação e consulta de pagamento. |
| **Escopo** | PaymentsService: normalização request→Payment; integração IdempotencyService, TransactionsService, ProvidersService, repositórios; mapeamento para DTO; checagem de acesso; transições de estado. |
| **Arquivos/pastas prováveis** | `src/payments/payments.service.ts`, `src/payments/mappers/`, integração com transactions, providers, idempotency, persistence. |
| **Dependências** | Commits 1, 2, 3; mais entidades/repositórios (Payment, Transaction). |
| **Referência documental** | `docs/requirements.md`, `docs/c4/components.md` (M3, fluxos 4.1–4.3), `docs/data-state.md`, `docs/quality.md` (§ 3.4). |

---

### Commit 5 — feat(controller): expose payment endpoints based on openapi specification

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Expor endpoints REST de pagamento conforme OpenAPI. |
| **Escopo** | PaymentsController: POST /v1/payments, GET /v1/payments/:paymentId, GET /v1/payments/by-idempotency-key/:idempotencyKey; DTO in/out; códigos HTTP conforme openapi. |
| **Arquivos/pastas prováveis** | `src/payments/payments.controller.ts`, `PaymentsModule`. |
| **Dependências** | Commits 1, 2, 4 (e 3 via 4). |
| **Referência documental** | `docs/api/openapi.md`, `docs/requirements.md`, `docs/c4/container.md`, `docs/c4/context.md`, `docs/quality.md` (§ 3.5). |

---

### Commit 6 — feat(exception-filters): standardize error handling layer

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Camada única de tratamento de erros com formato padronizado. |
| **Escopo** | Exception Filter global: corpo `{ code, message, details?, correlationId }`; mapeamento exceções→status/códigos; correlationId e sem vazamento de stack em prod. |
| **Arquivos/pastas prováveis** | `src/shared/filters/` ou `src/common/filters/`, registro global. |
| **Dependências** | Commit 1; aplicado após controller (5) para cobrir todas as rotas. |
| **Referência documental** | `docs/requirements.md`, `docs/api/openapi.md` (§ 3, § 6), `docs/quality.md` (§ 3.6). |

---

### Commit 7 — feat(interceptors): add correlation id logging and response interceptors

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Logging estruturado, correlation-id e métricas por requisição. |
| **Escopo** | Interceptor de logging (request/response, correlationId, latência); timeout para providers; métricas por endpoint/método/status. |
| **Arquivos/pastas prováveis** | `src/shared/interceptors/` ou `src/observability/interceptors/`, registro global. |
| **Dependências** | Commit 1; após controller (5) para cobrir todas as rotas. |
| **Referência documental** | `docs/requirements.md`, `docs/quality.md` (§ 1.2, § 1.3, § 3.7), `docs/c4/components.md` (M7). |

---

### Commit 8 — feat(guards): implement authorization guards

| Campo | Conteúdo |
|------|----------|
| **Objetivo** | Proteção de rotas com autenticação e autorização. |
| **Escopo** | JwtAuthGuard (e opcional API Key) nas rotas de payments; extração de identidade e escopo do cliente; falhas no formato padronizado. |
| **Arquivos/pastas prováveis** | `src/auth/guards/`, `src/auth/strategies/`, `@UseGuards()` no PaymentsController. |
| **Dependências** | Commits 1, 5; beneficia-se de 6 e 7. |
| **Referência documental** | `docs/requirements.md`, `docs/quality.md` (§ 2.1, § 3.8), `docs/c4/components.md` (M2). |

---

## 3. Estrutura final sugerida do projeto

Árvore de diretórios esperada após implementação (apenas diretórios relevantes para o plano; arquivos de configuração e testes omitidos):

```
src/
├── app.module.ts
├── main.ts
├── config/
│   └── (config module, env)
├── auth/
│   ├── auth.module.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── payments/
│   ├── payments.module.ts
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   ├── dto/
│   │   ├── create-payment.dto.ts
│   │   ├── payment-response.dto.ts
│   │   └── ...
│   └── mappers/
│       └── payment.mapper.ts
├── transactions/
│   ├── transactions.module.ts
│   └── transactions.service.ts
├── idempotency/
│   ├── idempotency.module.ts
│   ├── idempotency.service.ts
│   └── storage/
│       └── (idempotency store abstraction)
├── providers/
│   ├── providers.module.ts
│   ├── providers.service.ts
│   └── (adapters, e.g. mock-psp.client.ts)
├── shared/   # ou observability/
│   ├── shared.module.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── timeout.interceptor.ts
│   │   └── metrics.interceptor.ts
│   └── middleware/
│       └── correlation-id.middleware.ts
├── persistence/   # ou database/
│   ├── persistence.module.ts
│   ├── entities/
│   │   ├── payment.entity.ts
│   │   ├── transaction.entity.ts
│   │   └── idempotency-record.entity.ts
│   └── (repositories or TypeORM config)
├── cache/
│   ├── cache.module.ts
│   └── (Redis/cache client)
├── health/
│   ├── health.module.ts
│   └── health.controller.ts
└── common/   # opcional: pipes, DTOs compartilhados
    ├── pipes/
    └── dto/
```

---

## 4. Estratégia de execução das futuras branches

Este plano será usado nas próximas branches de feature da seguinte forma:

1. **Uma branch de feature por commit (recomendado):** Cada commit do plano pode virar uma branch de feature (ex.: `feat/modules-scaffold`, `feat/dto-validation`, `feat/idempotency`, …). A branch é criada a partir de `main` (ou da branch de integração atual), aplica-se **apenas** as alterações daquele commit, e o PR é revisado e mergeado. A ordem de merge deve respeitar as dependências do plano (1 → 2 → 3 → 4 → 5 → 6, 7, 8).

2. **Uso do DEV Commit Log:** O arquivo `docs/dev-commit-logs/implementation-commit-plan.md` é a referência para:
   - **Objetivo e escopo** de cada commit.
   - **Arquivos/pastas prováveis** para evitar esquecer módulos ou camadas.
   - **Dependências** para saber em qual branch basear e o que já deve existir.
   - **Referência documental** para validar contratos, estados e convenções em `docs/`.

3. **Validação por documento:** Antes de considerar um commit “pronto”, verificar que:
   - Os endpoints e DTOs batem com `docs/api/openapi.md`.
   - Estados e entidades batem com `docs/data-state.md`.
   - Comportamento de idempotência e erros batem com `docs/requirements.md` e `docs/api/openapi.md` (§ 3, § 6).
   - Checklist de qualidade em `docs/quality.md` está atendido na camada correspondente.

4. **Não alterar domínio nesta fase:** O plano não altera requisitos nem documentação; as próximas branches implementam código que **segue** a documentação existente. Ajustes de documentação devem ser feitos em branches separadas (ex.: `docs/...`) e mergeados antes ou em paralelo, conforme combinado.

5. **Critério de pronto da branch de planejamento:** A branch `planning/implementation-commit-plan` está pronta quando este plano e o DEV Commit Log estão completos e revisados; nenhum código é implementado nela. As branches de implementação são criadas a partir de outra base (ex.: `main` ou `chore/project-setup` já integrado).

---

## 5. DEV COMMIT LOG FINAL

O conteúdo completo do DEV Commit Log está em:

**`docs/dev-commit-logs/implementation-commit-plan.md`**

Inclui: nome da branch, objetivo, escopo, lista ordenada dos commits, descrição curta de cada commit, dependências principais, relação com a documentação e critério de pronto da branch.
