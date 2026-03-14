# DEV COMMIT LOG — planning/implementation-commit-plan

## Branch

**Nome:** `planning/implementation-commit-plan`

## Objetivo da branch

Transformar a documentação consolidada do Payment Hub API em um **plano seguro, incremental e profissional de implementação guiada por commits**. Este passo **não implementa código**; apenas organiza a execução futura das features (criar pagamento, consultar pagamento, idempotência) em uma sequência de commits coerente com NestJS e dependências arquiteturais.

**Fonte de verdade:** `docs/` (requirements.md, api/openapi.md, data-state.md, c4/*.md, quality.md, roadmap.md, INTEGRATION-REVIEW.md).

---

## Escopo

- **Fluxos cobertos:** Criar pagamento, Consultar pagamento, Idempotência de pagamento.
- **Ordem de implementação:** modules → dto → idempotency → payment-service → controller → exception-filters → interceptors → guards.
- **Fora do escopo desta branch:** implementação de código, criação de feature branches, alteração de domínio ou documentação.

---

## Lista ordenada dos commits planejados

| # | Commit | Descrição curta |
|---|--------|-----------------|
| 1 | `feat(modules): scaffold core application modules` | Estrutura modular: App, Config, Auth, Payments, Transactions, Idempotency, Providers, Shared/Observability, Persistence, Cache, Health. |
| 2 | `feat(dto): implement api contracts and validation layer` | DTOs de request/response alinhados ao OpenAPI; ValidationPipe global; validações declarativas. |
| 3 | `feat(idempotency): implement idempotency module and key validation` | IdempotencyModule, IdempotencyService, storage (DB/cache), verificação de chave e replay/conflito. |
| 4 | `feat(payment-service): implement payment orchestration service` | PaymentsService orquestrando criar/consultar; integração com Idempotency, Transactions e Providers. |
| 5 | `feat(controller): expose payment endpoints based on openapi specification` | PaymentsController: POST /v1/payments, GET /v1/payments/:paymentId, GET /v1/payments/by-idempotency-key/:key. |
| 6 | `feat(exception-filters): standardize error handling layer` | Exception Filter global; corpo `{ code, message, details?, correlationId }`; mapeamento de exceções para status/códigos. |
| 7 | `feat(interceptors): add correlation id logging and response interceptors` | Interceptor de logging (request/response, correlationId, latência); interceptor de timeout e métricas. |
| 8 | `feat(guards): implement authorization guards` | JwtAuthGuard (e opcional API Key) aplicado às rotas de pagamento; extração de escopo do cliente. |

---

## Descrição curta de cada commit

### 1. feat(modules): scaffold core application modules

- **Objetivo:** Estabelecer a estrutura de módulos NestJS sem lógica de negócio.
- **Escopo:** AppModule importando ConfigModule, AuthModule, PaymentsModule, TransactionsModule, IdempotencyModule, ProvidersModule, SharedModule (ou ObservabilityModule), PersistenceModule (ou DatabaseModule), CacheModule (ou IdempotencyStoreModule), HealthModule. Cada módulo com `imports`/`exports` mínimos; nenhum módulo "Deus".
- **Arquivos/pastas prováveis:** `src/app.module.ts`, `src/config/`, `src/auth/`, `src/payments/`, `src/transactions/`, `src/idempotency/`, `src/providers/`, `src/shared/` ou `src/observability/`, `src/persistence/` ou `src/database/`, `src/cache/`, `src/health/` (ou reuso do HealthModule existente).
- **Dependências:** Nenhum (commit inicial da sequência de features).
- **Referência documental:** `docs/c4/container.md` (C2), `docs/c4/components.md` (M1–M10), `docs/quality.md` (§ 3.1).

---

### 2. feat(dto): implement api contracts and validation layer

- **Objetivo:** Contratos de API e camada de validação para criação e consulta de pagamento.
- **Escopo:** DTOs de request (CreatePaymentDto com payer, payee, amount, currency, paymentMethod, externalReference, etc.) e response (PaymentResponseDto) alinhados ao OpenAPI. ValidationPipe global (whitelist, forbidNonWhitelisted). Validações: obrigatoriedade, amount > 0, currency, paymentMethod.type, formatos (UUID, ISO 4217). Pipes de transformação para tipos/enums. Middlewares apenas cross-cutting: geração/extração de X-Correlation-Id, logging de request (sem dados sensíveis).
- **Arquivos/pastas prováveis:** `src/payments/dto/`, `src/shared/dto/`, `src/common/pipes/`, `src/common/middleware/`, configuração em `main.ts` ou `AppModule`.
- **Dependências:** Commit 1 (modules).
- **Referência documental:** `docs/requirements.md` (entradas body/headers, validações), `docs/api/openapi.md` (schemas request/response, headers), `docs/quality.md` (§ 3.2).

---

### 3. feat(idempotency): implement idempotency module and key validation

- **Objetivo:** Módulo de idempotência com verificação de chave, replay compatível e conflito.
- **Escopo:** IdempotencyService: verificação por (escopo do cliente autenticado, Idempotency-Key); first call vs replay compatível vs conflito; registro de vínculo e hash de payload. Abstração de storage (DB/Redis). Validação de Idempotency-Key (presença, tamanho máx. 128 caracteres). Não expõe endpoints HTTP; consumido por PaymentsModule.
- **Arquivos/pastas prováveis:** `src/idempotency/idempotency.service.ts`, `src/idempotency/idempotency.module.ts`, `src/idempotency/storage/`, entidade/repositório IdempotencyRecord (se já existir camada de persistência).
- **Dependências:** Commit 1 (modules). Se entidades/repositórios forem introduzidos antes, depende também da camada de persistência (TypeORM/entidades); caso contrário, este commit pode incluir apenas a lógica de idempotência e interfaces de storage.
- **Referência documental:** `docs/requirements.md` (fluxo idempotência, escopo cliente autenticado), `docs/data-state.md` (IdempotencyRecord, replay/conflito), `docs/c4/components.md` (M5 IdempotencyModule), `docs/quality.md` (§ 3.4, § 4.1, § 4.3).

---

### 4. feat(payment-service): implement payment orchestration service

- **Objetivo:** Serviço de orquestração de criação e consulta de pagamento.
- **Escopo:** PaymentsService: normalização do request em Payment (payer/payee → customerId/merchantId); chamada a IdempotencyService, TransactionsService, ProvidersService e repositórios; mapeamento para DTO de resposta; checagem de acesso (escopo do cliente autenticado). Transições de estado conforme data-state. Controllers permanecem finos.
- **Arquivos/pastas prováveis:** `src/payments/payments.service.ts`, `src/payments/mappers/`, integração com `src/transactions/`, `src/providers/`, `src/idempotency/`, `src/persistence/`.
- **Dependências:** Commits 1 (modules), 2 (dto), 3 (idempotency). Requer também entidades Payment/Transaction e repositórios (podem ser parte de commit de modules/persistence ou commit separado de typeorm antes deste).
- **Referência documental:** `docs/requirements.md` (fluxos criar/consultar, processamento alto nível), `docs/c4/components.md` (M3 PaymentsModule, fluxos 4.1–4.3), `docs/data-state.md` (state machine, mapeamento estados API↔interno), `docs/quality.md` (§ 3.4).

---

### 5. feat(controller): expose payment endpoints based on openapi specification

- **Objetivo:** Expor endpoints REST de pagamento conforme especificação OpenAPI.
- **Escopo:** PaymentsController: POST /v1/payments (criação), GET /v1/payments/:paymentId (consulta), GET /v1/payments/by-idempotency-key/:idempotencyKey (consulta por chave). Apenas receber DTOs, delegar a PaymentsService, mapear resultado para contrato de resposta. Códigos HTTP conforme openapi (201/200/400/401/403/404/409/422/429/500/503). Rotas versionadas com prefixo /v1.
- **Arquivos/pastas prováveis:** `src/payments/payments.controller.ts`, registro de rotas em `PaymentsModule`, possivelmente `src/payments/payments.module.ts`.
- **Dependências:** Commits 1, 2, 4 (payment-service). Opcionalmente 3 já integrado em 4.
- **Referência documental:** `docs/api/openapi.md` (endpoints, status por cenário), `docs/requirements.md` (status codes, saídas), `docs/c4/container.md` e `docs/c4/context.md` (rotas /v1), `docs/quality.md` (§ 3.5).

---

### 6. feat(exception-filters): standardize error handling layer

- **Objetivo:** Camada única de tratamento de erros com formato padronizado.
- **Escopo:** Exception Filter global: captura exceções e converte em resposta com corpo `{ code, message, details?, correlationId }` e status adequado. Garantir correlationId no payload (do contexto da request). Mapeamento: validação → PAYMENT_VALIDATION_ERROR (400); não encontrado → PAYMENT_NOT_FOUND (404); conflito idempotência → PAYMENT_IDEMPOTENCY_CONFLICT (409); regra de negócio → PAYMENT_BUSINESS_RULE_VIOLATION (422); auth → 401/403 com códigos; em produção sem stack/mensagens internas sensíveis.
- **Arquivos/pastas prováveis:** `src/shared/filters/` ou `src/common/filters/`, registro global em `main.ts` ou AppModule.
- **Dependências:** Commit 1 (modules). Pode ser aplicado após ou em paralelo ao controller; recomenda-se após para que todas as rotas já retornem erros padronizados.
- **Referência documental:** `docs/requirements.md` (padrão de erro, códigos, status), `docs/api/openapi.md` (§ 3 modelo de erro, § 6 taxonomia), `docs/quality.md` (§ 3.6).

---

### 7. feat(interceptors): add correlation id logging and response interceptors

- **Objetivo:** Logging estruturado, correlation-id e métricas por requisição.
- **Escopo:** Interceptor de logging: request/response ao nível controller; latência, método, rota, statusCode, correlationId, paymentId quando existir; sem dados sensíveis. Interceptor de timeout para chamadas a providers (e opcionalmente rotas internas). Interceptor de métrica: tempo de processamento e contagem por endpoint/método/status.
- **Arquivos/pastas prováveis:** `src/shared/interceptors/` ou `src/observability/interceptors/`, registro em AppModule ou módulo compartilhado.
- **Dependências:** Commit 1 (modules). Útil após controller (commit 5) para que todas as rotas sejam logadas/métricas.
- **Referência documental:** `docs/requirements.md` (observabilidade, correlationId), `docs/quality.md` (§ 1.2 Logging, § 1.3 Métricas, § 3.7), `docs/c4/components.md` (M7 Observability).

---

### 8. feat(guards): implement authorization guards

- **Objetivo:** Proteção de rotas com autenticação e autorização.
- **Escopo:** JwtAuthGuard aplicado aos endpoints de payments; validação de token e extração de identidade e escopo do cliente autenticado. Guard opcional de API Key (X-Api-Key) para integrações server-to-server, se adotado. Uso de metadata/roles em decorators para permissão por rota; falhas retornadas no formato padronizado e logadas.
- **Arquivos/pastas prováveis:** `src/auth/guards/`, `src/auth/strategies/`, aplicação com `@UseGuards()` no PaymentsController.
- **Dependências:** Commits 1 (AuthModule), 5 (controller). Exception Filters (6) e Interceptors (7) melhoram a experiência de erros e logs quando os guards rejeitam.
- **Referência documental:** `docs/requirements.md` (Authorization obrigatório, 401/403), `docs/quality.md` (§ 2.1 Guards, § 3.8), `docs/c4/components.md` (M2 AuthModule).

---

## Dependências principais entre commits

```
modules (1)
  ├── dto (2)
  │     └── idempotency (3)
  │           └── payment-service (4)
  │                 └── controller (5)
  ├── exception-filters (6)
  ├── interceptors (7)
  └── guards (8) [depende de 1, 5; beneficia-se de 6, 7]
```

- **1 → 2, 6, 7, 8:** Todos os commits de feature dependem da estrutura de módulos.
- **2 → 3, 4:** DTOs e validação são base para idempotency e payment-service.
- **3 → 4:** IdempotencyService é usado pelo PaymentsService.
- **4 → 5:** Controller delega ao PaymentsService.
- **5 → 8:** Guards são aplicados ao controller; 6 e 7 podem ser feitos em paralelo ou após 5 para padronizar erros e logs.

---

## Relação com a documentação

| Área | Documentos |
|------|-------------|
| Fluxos e requisitos | `docs/requirements.md` |
| Contratos e status/códigos de erro | `docs/api/openapi.md` |
| Entidades, estados e idempotência | `docs/data-state.md` |
| Módulos e fluxos por componente | `docs/c4/components.md`, `docs/c4/container.md`, `docs/c4/context.md` |
| Qualidade, observabilidade, guards | `docs/quality.md` |
| Fases MVP (Fase A) | `docs/roadmap.md` |
| Plano por etapa Nest e commits sugeridos | `docs/INTEGRATION-REVIEW.md` |
| Setup técnico prévio | `docs/dev-commit-logs/project-setup.md` |

---

## Critério de pronto da branch

- [ ] Plano de implementação guiada por commits documentado e revisável.
- [ ] Ordem dos commits justificada e alinhada à trilha NestJS (modules → dto → idempotency → payment-service → controller → exception-filters → interceptors → guards).
- [ ] Cada commit com objetivo, escopo, arquivos/pastas prováveis, dependências e referência documental.
- [ ] DEV Commit Log (`implementation-commit-plan.md`) completo com lista ordenada, descrição curta por commit, dependências principais e relação com a documentação.
- [ ] Nenhum código implementado nesta branch; nenhuma feature branch criada.
- [ ] Documentação em `docs/` permanece a fonte da verdade para as próximas branches de implementação.

---

*Gerado pelo agente Senior NestJS Implementation Planner. Branch: planning/implementation-commit-plan.*
