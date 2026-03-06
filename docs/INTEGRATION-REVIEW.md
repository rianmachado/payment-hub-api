# Integration Review — Consistency + Implementation Plan

Revisão de consistência entre `requirements.md`, C4 (`context.md`, `container.md`, `components.md`), `openapi.md`, `quality.md`, `roadmap.md` e `data-state.md`.

---

## 1. Inconsistências e correções mínimas sugeridas

### 1.1 Nomes e campos

| Onde | Inconsistência | Correção sugerida |
|------|----------------|-------------------|
| **data-state** vs **requirements/openapi** | Payment usa `customerId`/`merchantId`; API usa objetos `payer`/`payee` com `id` ou `externalId`. | Em data-state: documentar que `customerId` = identificador do pagador (de `payer.id` ou `payer.externalId`), `merchantId` = favorecido (de `payee`). |
| **data-state** | Payment não lista `completedAt`, `idempotencyKey`, `correlationId`. | Adicionar: `completedAt` (datetime, opcional), `idempotencyKey` (string, opcional), `correlationId` (string, opcional). |
| **data-state** | IdempotencyRecord unique `(idempotencyKey, scope)` sem tenant. | Para multi-tenant: unique `(tenantId, idempotencyKey, scope)` e incluir campo `tenantId` em IdempotencyRecord. |
| **data-state** vs **API** | Estados internos: `INITIATED`, `CAPTURED`, `EXPIRED`; API: `CREATED`, `SETTLED`, etc. | Documentar mapeamento: `CREATED`↔`INITIATED`, `SETTLED`↔`CAPTURED`; `EXPIRED`→`FAILED` ou status específico. |
| **requirements** vs **openapi** | business key como combinação lógica; API envia `externalReference`. | Manter `externalReference` na API; em data-state usar `businessReference` em Payment recebendo valor de `externalReference`. |

### 1.2 Endpoints e rotas

| Onde | Inconsistência | Correção sugerida |
|------|----------------|-------------------|
| **requirements** | Consultar pagamento cita só `paymentId` ou `externalReference+cliente`; não cita consulta por idempotency key. | Incluir referência ao fluxo de consulta por Idempotency-Key ou apontar para openapi (GET by-idempotency-key). |
| **context.md / container.md** | Só listam `POST /payments` e `GET /payments/{paymentId}`. | Incluir `GET /payments/by-idempotency-key/{idempotencyKey}` nas relações Cliente → Payment Hub API. |
| **openapi** vs **quality** | quality exige rotas versionadas (ex.: v1); openapi não usa `/v1`. | Decidir: se versionamento for adotado, usar prefixo `/v1` em openapi e requirements; senão, marcar versionamento como futuro no checklist. |
| **quality / container** | HealthModule e health citados em quality; não aparecem em container/components. | Incluir HealthModule em components (ex.: M10) e endpoint GET /health em openapi/context. |

### 1.3 Status codes e convenções

| Onde | Inconsistência | Correção sugerida |
|------|----------------|-------------------|
| **requirements** e **openapi** | Replay idempotente: "201/200" e "200 OK ou 201 Created (conforme convenção)". | Unificar: "Primeira criação → 201 Created; replay compatível → 200 OK" em requirements e openapi. |
| **openapi / requirements** | 401/403/429/500/503 sem códigos de erro (`code`) definidos. | Sugerir taxonomia: `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID`, `AUTH_INSUFFICIENT_PERMISSION`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. |

### 1.4 Serviços e componentes

| Onde | Inconsistência | Correção sugerida |
|------|----------------|-------------------|
| **quality 3.4** | Cita "ReplayService"; components e requirements usam apenas IdempotencyService. | Alinhar: usar IdempotencyService; remover ou renomear ReplayService. |
| **quality 3.4** | Cita "ProviderGatewayService"; components usa "ProvidersService ou ProviderGateway". | Unificar: `ProvidersService` como contrato principal; ProviderGateway como alias ou implementação. |
| **components** | M9: "IdempencyStoreModule" (typo). | Corrigir para `IdempotencyStoreModule`. |

### 1.5 Idempotência e roadmap

| Onde | Inconsistência | Correção sugerida |
|------|----------------|-------------------|
| **requirements** | "Idempotency-Key dentro do limite de tamanho aceito" sem valor. | Especificar em requirements (e openapi): ex. "tamanho máximo 128 caracteres". |
| **roadmap** | Fase A: "replay compatível (sem conflitos avançados ainda)"; openapi já descreve 409 e conflito. | Esclarecer: Fase A = replay compatível + 409 básico; Fase B = comparação canônica completa e retenção/expiração. Incluir GET by-idempotency-key em Fase A ou B. |

### 1.6 Autorização e outros

| Onde | Inconsistência | Correção sugerida |
|------|----------------|-------------------|
| **README** (fluxo 2.1) | Headers obrigatórios listam só Idempotency-Key e X-Correlation-Id. | Incluir `Authorization` nos headers obrigatórios de criação/consulta. |
| **requirements / openapi** | "currency suportada pelo hub" sem lista. | Documentar lista mínima (ex.: BRL, USD) em requirements ou openapi. |
| **components** | AppModule não cita ConfigModule. | Incluir ConfigModule na composição do AppModule em components. |

---

## 2. Plano de implementação (guided) — por etapa Nest

Ordem: **Modules → DTO/Validation/Pipes/Middlewares → TypeORM → Services → Controllers → Exception Filters → Interceptors → Guards → Auth JWT.**

Para cada etapa: o que fazer (sem código) e **quais docs sustentam**.

---

### Etapa 1 — Modules

- Definir e registrar módulos: AppModule, ConfigModule, AuthModule, PaymentsModule, TransactionsModule, IdempotencyModule, ProvidersModule, SharedModule (ou ObservabilityModule), PersistenceModule (ou DatabaseModule), CacheModule (ou IdempotencyStoreModule), HealthModule.
- AppModule importa e compõe todos; ConfigModule centraliza variáveis de ambiente.
- Nenhum módulo "Deus"; exports apenas o necessário.

**Docs:** `docs/c4/container.md` (C2, módulos do hub), `docs/c4/components.md` (M1–M9), `docs/quality.md` (§ 3.1 Modules, ConfigModule, HealthModule).

---

### Etapa 2 — DTO / Validation / Pipes / Middlewares

- DTOs de request/response para criação e consulta de pagamento alinhados ao openapi (payer, payee, amount, currency, paymentMethod, externalReference, etc.).
- Validações declarativas: obrigatoriedade, amount > 0, currency, paymentMethod.type, formatos (UUID, ISO 4217).
- ValidationPipe global: whitelist, forbidNonWhitelisted (prod).
- Pipes para transformação (tipos, enums) sem lógica em controller/service.
- Middlewares apenas cross-cutting: geração/extração de X-Correlation-Id, logging de request (sem dados sensíveis).

**Docs:** `docs/requirements.md` (entradas body/headers, validações essenciais), `docs/api/openapi.md` (schemas request/response, headers), `docs/quality.md` (§ 3.2 DTO/Validation/Pipes/Middlewares).

---

### Etapa 3 — TypeORM

- Entidades: Payment, Transaction, IdempotencyRecord (e opcionalmente ProviderConfig, EventLog) conforme data-state.
- Campos de Payment: id, businessReference, amount, currency, status, customerId, merchantId, providerId, idempotencyKey, correlationId, completedAt, createdAt, updatedAt, metadata; índices e uniques conforme data-state.
- IdempotencyRecord com tenantId e unique (tenantId, idempotencyKey, scope).
- Transações para escritas que alteram mais de uma entidade; synchronize desligado fora de teste; uso de migrations.

**Docs:** `docs/data-state.md` (entidades, state machine, uniques, índices), `docs/requirements.md` (modelo payment/transaction, invariantes), `docs/quality.md` (§ 3.3 TypeORM).

---

### Etapa 4 — Services

- PaymentsService: orquestração criar/consultar; normalização do request em Payment; chamada a IdempotencyService, TransactionsService, ProvidersService e repositórios; mapeamento para DTO de resposta; checagem de acesso (tenant/recurso).
- IdempotencyService: verificação por (tenant, Idempotency-Key); first call vs replay compatível vs conflito; registro de vínculo e hash de payload; delegação de storage a Persistence/Cache.
- TransactionsService: criação/atualização de Transaction ligada a Payment; atualização de estado conforme resposta do provider.
- ProvidersService (ou ProviderGateway): interface estável (ex.: processPayment); adaptadores para PSP/Mock; tradução de respostas para modelo interno.
- Lógica de negócio e transição de estado centralizadas em serviços; controllers finos.

**Docs:** `docs/requirements.md` (fluxos criar/consultar/idempotência, processamento alto nível), `docs/c4/components.md` (fluxos por componente M3–M6), `docs/data-state.md` (state machine, idempotência), `docs/quality.md` (§ 3.4 Services).

---

### Etapa 5 — Controllers

- PaymentsController: POST /payments (criação), GET /payments/:paymentId (consulta), GET /payments/by-idempotency-key/:idempotencyKey (consulta por chave).
- Controllers só: receber DTOs, delegar a serviços, mapear resultado para contrato de resposta; códigos HTTP conforme openapi (201/200/400/401/403/404/409/422/429/500/503).
- Nenhum acesso direto a repositório/DB no controller.

**Docs:** `docs/api/openapi.md` (endpoints, status por cenário), `docs/requirements.md` (status codes possíveis, saídas), `docs/c4/context.md` e `docs/c4/container.md` (rotas), `docs/quality.md` (§ 3.5 Controllers).

---

### Etapa 6 — Exception Filters

- Exception Filter global: captura exceções da aplicação e converte em resposta com corpo `{ code, message, details?, correlationId }` e status adequado.
- Garantir correlationId no payload de erro (do contexto da request).
- Mapeamento: validação → PAYMENT_VALIDATION_ERROR (400); não encontrado → PAYMENT_NOT_FOUND (404); conflito idempotência → PAYMENT_IDEMPOTENCY_CONFLICT (409); regra de negócio → PAYMENT_BUSINESS_RULE_VIOLATION (422); auth → 401/403 com código; em produção sem stack/mensagens internas sensíveis.

**Docs:** `docs/requirements.md` (padrão de erro, códigos, status), `docs/api/openapi.md` (§ 3 modelo de erro, § 6 taxonomia), `docs/quality.md` (§ 3.6 Exception Filters).

---

### Etapa 7 — Interceptors

- Interceptor de logging: request/response ao nível controller; latência, método, rota, statusCode, correlationId, paymentId quando existir; sem dados sensíveis.
- Interceptor de timeout para chamadas a providers (e opcionalmente rotas internas pesadas).
- Interceptor de métrica: tempo de processamento e contagem por endpoint/método/status.

**Docs:** `docs/requirements.md` (observabilidade, correlationId), `docs/quality.md` (§ 1.2 Logging, § 1.3 Métricas, § 3.7 Interceptors), `docs/c4/components.md` (M7 Observability).

---

### Etapa 8 — Guards

- Guard de autenticação (ex.: JWT) aplicado aos endpoints de payments; validação de token e extração de identidade/tenant/escopo.
- Guard opcional de API Key (ex.: X-Api-Key) para integrações server-to-server, se adotado.
- Uso de metadata/roles em decorators para definir permissão por rota; falhas retornadas no formato padronizado e logadas.

**Docs:** `docs/requirements.md` (Authorization obrigatório, 401/403), `docs/quality.md` (§ 2.1 Guards, § 3.8 Guards), `docs/c4/components.md` (M2 AuthModule).

---

### Etapa 9 — Auth JWT

- Validação de assinatura, issuer, audience, exp, iat em um único componente de autenticação.
- Extração de sub, roles/permissions e tenant (ou clientId) para contexto acessível na aplicação.
- JWT não como fonte de dados sensíveis; suporte a rotação de chaves/segredos (janela de migração).

**Docs:** `docs/requirements.md` (autenticação OAuth2/JWT, escopo/tenant), `docs/quality.md` (§ 2.2 Escopo JWT, § 3.9 Auth JWT), `docs/c4/context.md` (Provider de Identidade/Auth).

---

## 3. Seção para README.md — "Implementation Plan (guided)"

*(Conteúdo pronto para colar no README.)*

---

## Implementation Plan (guided)

O plano de implementação segue a ordem de fixação NestJS definida em [docs/requirements.md](docs/requirements.md) e detalhada em [docs/INTEGRATION-REVIEW.md](docs/INTEGRATION-REVIEW.md):

1. **Modules** — Estrutura modular (App, Config, Auth, Payments, Transactions, Idempotency, Providers, Shared/Observability, Persistence, Cache, Health). *Ref.: container.md, components.md, quality.md.*

2. **DTO / Validation / Pipes / Middlewares** — DTOs alinhados ao OpenAPI; ValidationPipe global; middlewares para correlation-id e logging. *Ref.: requirements.md, openapi.md, quality.md.*

3. **TypeORM** — Entidades Payment, Transaction, IdempotencyRecord (e opcionais); migrations; transações; sem synchronize em não-test. *Ref.: data-state.md, requirements.md, quality.md.*

4. **Services** — PaymentsService, IdempotencyService, TransactionsService, ProvidersService; orquestração e regras de negócio. *Ref.: requirements.md, components.md, data-state.md, quality.md.*

5. **Controllers** — PaymentsController: POST /payments, GET /payments/:paymentId, GET /payments/by-idempotency-key/:idempotencyKey; códigos HTTP conforme OpenAPI. *Ref.: openapi.md, requirements.md, context.md, container.md, quality.md.*

6. **Exception Filters** — Filtro global; formato { code, message, details?, correlationId }; mapeamento de exceções para status e códigos. *Ref.: requirements.md, openapi.md, quality.md.*

7. **Interceptors** — Logging, timeout (providers), métricas por endpoint. *Ref.: requirements.md, quality.md, components.md.*

8. **Guards** — Proteção de rotas (JWT; opcional API Key); roles/metadata por rota. *Ref.: requirements.md, quality.md, components.md.*

9. **Auth JWT** — Validação de token (iss, aud, exp, iat); contexto de identidade e tenant; rotação de chaves. *Ref.: requirements.md, quality.md, context.md.*

Cada etapa deve ser implementada e testada antes de avançar; os documentos em `docs/` são a fonte de verdade para contratos, estados e convenções.

---

## 4. Lista de commits sugeridos (Conventional Commits)

```
feat(app): add module structure (App, Config, Auth, Payments, Transactions, Idempotency, Providers, Shared, Persistence, Cache, Health)

feat(dto): add request/response DTOs for create and get payment aligned to OpenAPI

feat(validation): configure global ValidationPipe with whitelist and forbidNonWhitelisted

feat(pipes): add transform pipes for paymentId, enums and amount/currency

feat(middleware): add CorrelationIdMiddleware to generate or propagate X-Correlation-Id

feat(typeorm): add Payment, Transaction and IdempotencyRecord entities per data-state

feat(typeorm): add migrations and disable synchronize for non-test env

feat(services): add IdempotencyService for key lookup and replay/conflict handling

feat(services): add TransactionsService for transaction lifecycle and state

feat(services): add ProvidersService (gateway) and MockPspClient adapter

feat(services): add PaymentsService orchestrating create and get flows

feat(controllers): add PaymentsController with POST /payments and GET /payments/:paymentId

feat(controllers): add GET /payments/by-idempotency-key/:idempotencyKey

feat(filters): add global HttpExceptionFilter with standardized error body and correlationId

feat(interceptors): add logging interceptor for request/response and correlationId

feat(interceptors): add timeout interceptor for provider calls

feat(interceptors): add metrics interceptor for latency and request count by endpoint

feat(guards): add JwtAuthGuard and apply to payment routes

feat(auth): add JWT strategy and validation (iss, aud, exp, iat)

feat(auth): extract identity and tenant from token into request context

docs: add INTEGRATION-REVIEW with consistency notes and implementation plan
```

---

*Documento gerado a partir de requirements.md, docs/c4/*.md, docs/api/openapi.md, docs/quality.md, docs/roadmap.md e docs/data-state.md.*
