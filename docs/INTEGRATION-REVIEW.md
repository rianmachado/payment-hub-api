# Integration Review — Consistency + Implementation Plan

Revisão de consistência entre `requirements.md`, C4 (`context.md`, `container.md`, `components.md`), `openapi.md`, `quality.md`, `roadmap.md` e `data-state.md`. Este documento é mantido como revisão viva: pendências resolvidas são movidas para a seção 1.2; apenas itens em aberto permanecem em 1.1.

**Fonte de verdade para agentes de IA:** Os documentos em `docs/` (requirements.md, api/openapi.md, data-state.md, c4/*.md, quality.md, roadmap.md, INTEGRATION-REVIEW.md) constituem a **fonte de verdade única** para implementação do Payment Hub API. Agentos devem seguir o plano de implementação guiada (§2), as referências cruzadas entre documentos e os contratos/estados aqui definidos. A implementação guiada pode ser iniciada; não há pendências críticas bloqueantes.

---

## 1. Estado da revisão

### 1.1. Pendências ainda abertas (nenhuma — pronto para implementação guiada)

Nenhuma pendência crítica em aberto após a harmonização final. Os itens abaixo foram objeto de ajuste e **já estão refletidos** nos documentos; a implementação guiada (§2) pode ser iniciada:

- **Alinhamento de versionamento de API**: Prefixo `/v1` adotado em [openapi.md](api/openapi.md) para todos os endpoints de pagamento e health; quality.md e C4 referenciam rotas versionadas.
- **Harmonização de nomes de serviços**: Padronizado em toda a documentação: `IdempotencyService` (não ReplayService), `ProvidersService` como contrato principal (não ProviderGatewayService); quality.md § 3.4 e INTEGRATION-REVIEW referenciam explicitamente.
- **Escopo de idempotência**: Padronizado para **escopo do cliente autenticado** + Idempotency-Key em quality.md, openapi.md, context.md, container.md e data-state; nota explícita: *O MVP não assume multi-tenant; em evolução futura o escopo poderá ser materializado como tenantId.*

### 1.2. Pendências já resolvidas (harmonização documental)

- **Mapeamento payer/payee → customerId/merchantId**: Documentado em `data-state.md`, `openapi.md` e requirements; normalização na criação e nas respostas.
- **Harmonização de estados internos vs API**: Mapeamento completo (CREATED↔INITIATED, SETTLED↔CAPTURED, etc.) em `data-state.md` e `openapi.md` §7.
- **Inclusão do endpoint por idempotency key**: `GET /v1/payments/by-idempotency-key/{idempotencyKey}` em requirements, openapi, context, container e roadmap (Fase A).
- **Idempotency-Key**: Tamanho máximo 128 caracteres; escopo = escopo do cliente autenticado; nota MVP/multi-tenant em quality, openapi, C4.
- **Roadmap**: Fase A = criação, consulta por paymentId e por idempotency-key, replay + 409 básico. Fase B = idempotência avançada.
- **Payment (data-state)**: Entidade com `completedAt`, `idempotencyKey`, `correlationId`; IdempotencyRecord com escopo (clientScope/tenantId) documentado; MVP = escopo do cliente autenticado.
- **ConfigModule, HealthModule**: Incluídos em components e C4; GET /health em context e container.
- **Replay 201/200**: Unificado em requirements e openapi; taxonomia de códigos de erro documentada.
- **Moedas**: Lista mínima (BRL, USD) em requirements e openapi.
- **README**: Seção Security Model adicionada; Authorization obrigatório e Idempotency-Key/X-Correlation-Id documentados nos headers.

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
- IdempotencyRecord com escopo do cliente (campo clientScope ou tenantId conforme implementação) e unique (escopo, idempotencyKey, scope).
- Transações para escritas que alteram mais de uma entidade; synchronize desligado fora de teste; uso de migrations.

**Docs:** `docs/data-state.md` (entidades, state machine, uniques, índices), `docs/requirements.md` (modelo payment/transaction, invariantes), `docs/quality.md` (§ 3.3 TypeORM).

---

### Etapa 4 — Services

- PaymentsService: orquestração criar/consultar; normalização do request em Payment; chamada a IdempotencyService, TransactionsService, ProvidersService e repositórios; mapeamento para DTO de resposta; checagem de acesso (escopo do cliente autenticado/recurso).
- IdempotencyService: verificação por (escopo do cliente autenticado, Idempotency-Key); first call vs replay compatível vs conflito; registro de vínculo e hash de payload; delegação de storage a Persistence/Cache.
- TransactionsService: criação/atualização de Transaction ligada a Payment; atualização de estado conforme resposta do provider.
- ProvidersService: contrato principal de integração com PSPs; interface estável (ex.: processPayment); adaptadores para PSP/Mock; tradução de respostas para modelo interno.
- Lógica de negócio e transição de estado centralizadas em serviços; controllers finos.

**Docs:** `docs/requirements.md` (fluxos criar/consultar/idempotência, processamento alto nível), `docs/c4/components.md` (fluxos por componente M3–M6), `docs/data-state.md` (state machine, idempotência), `docs/quality.md` (§ 3.4 Services).

---

### Etapa 5 — Controllers

- PaymentsController: POST /v1/payments (criação), GET /v1/payments/:paymentId (consulta), GET /v1/payments/by-idempotency-key/:idempotencyKey (consulta por chave).
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

- Guard de autenticação (ex.: JWT) aplicado aos endpoints de payments; validação de token e extração de identidade e escopo do cliente autenticado.
- Guard opcional de API Key (ex.: X-Api-Key) para integrações server-to-server, se adotado.
- Uso de metadata/roles em decorators para definir permissão por rota; falhas retornadas no formato padronizado e logadas.

**Docs:** `docs/requirements.md` (Authorization obrigatório, 401/403), `docs/quality.md` (§ 2.1 Guards, § 3.8 Guards), `docs/c4/components.md` (M2 AuthModule).

---

### Etapa 9 — Auth JWT

- Validação de assinatura, issuer, audience, exp, iat em um único componente de autenticação.
- Extração de sub, roles/permissions e escopo do cliente (ex.: clientId) para contexto acessível na aplicação.
- JWT não como fonte de dados sensíveis; suporte a rotação de chaves/segredos (janela de migração).

**Docs:** `docs/requirements.md` (autenticação OAuth2/JWT, escopo do cliente), `docs/quality.md` (§ 2.2 Escopo JWT, § 3.9 Auth JWT), `docs/c4/context.md` (Provider de Identidade/Auth).

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

5. **Controllers** — PaymentsController: POST /v1/payments, GET /v1/payments/:paymentId, GET /v1/payments/by-idempotency-key/:idempotencyKey; códigos HTTP conforme OpenAPI. *Ref.: openapi.md, requirements.md, context.md, container.md, quality.md.*

6. **Exception Filters** — Filtro global; formato { code, message, details?, correlationId }; mapeamento de exceções para status e códigos. *Ref.: requirements.md, openapi.md, quality.md.*

7. **Interceptors** — Logging, timeout (providers), métricas por endpoint. *Ref.: requirements.md, quality.md, components.md.*

8. **Guards** — Proteção de rotas (JWT; opcional API Key); roles/metadata por rota. *Ref.: requirements.md, quality.md, components.md.*

9. **Auth JWT** — Validação de token (iss, aud, exp, iat); contexto de identidade e escopo do cliente autenticado; rotação de chaves. *Ref.: requirements.md, quality.md, context.md.*

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

feat(controllers): add PaymentsController with POST /v1/payments and GET /v1/payments/:paymentId

feat(controllers): add GET /v1/payments/by-idempotency-key/:idempotencyKey

feat(filters): add global HttpExceptionFilter with standardized error body and correlationId

feat(interceptors): add logging interceptor for request/response and correlationId

feat(interceptors): add timeout interceptor for provider calls

feat(interceptors): add metrics interceptor for latency and request count by endpoint

feat(guards): add JwtAuthGuard and apply to payment routes

feat(auth): add JWT strategy and validation (iss, aud, exp, iat)

feat(auth): extract identity and client scope from token into request context

docs: add INTEGRATION-REVIEW with consistency notes and implementation plan

docs(review): declare docs as source of truth for AI agents and mark §1.1 ready for guided implementation
```

---

*Documento gerado a partir de requirements.md, docs/c4/*.md, docs/api/openapi.md, docs/quality.md, docs/roadmap.md e docs/data-state.md.*
