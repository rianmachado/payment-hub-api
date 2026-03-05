## C4 — Nível 3: Visão de Componentes (módulos NestJS)

### 1. Componentes principais (mapeados para módulos Nest)

Abaixo, os principais componentes internos da `Payment Hub API`, representados como **módulos NestJS** e seus papéis:

- **M1. AppModule**
  - Módulo raiz.
  - Responsabilidades:
    - Compor todos os módulos de domínio e infraestrutura:
      - `PaymentsModule`, `TransactionsModule`, `IdempotencyModule`,
        `ProvidersModule`, `AuthModule`, `SharedModule/Observability`, etc.
    - Registrar middlewares globais (ex.: extração de `X-Correlation-Id`, logging básico).
    - Configurar providers compartilhados (ex.: conexões com DB, Redis).

- **M2. AuthModule**
  - Módulo responsável por autenticação/autorização.
  - Componentes típicos:
    - `AuthService` (validação de tokens / comunicação com provider externo).
    - `JwtStrategy` / `Guards` (por exemplo `JwtAuthGuard`).
  - Responsabilidades:
    - Validar `Authorization` em cada requisição.
    - Expor guards usados nos controllers (`@UseGuards`).
    - Encapsular qualquer detalhe de integração com o provider de identidade.

- **M3. PaymentsModule**
  - Módulo de **orquestração de pagamentos**.
  - Componentes:
    - `PaymentsController` — endpoints HTTP:
      - `POST /payments` (criar).
      - `GET /payments/{paymentId}` (consultar).
    - `PaymentsService` — orquestra lógica de alto nível de criação/consulta.
    - DTOs, pipes de validação, mapeadores.
  - Responsabilidades:
    - Validar entradas de criação/consulta conforme requisitos.
    - Chamar serviços de idempotência, transações, providers e repositórios.
    - Mapear entidades de domínio para DTOs de resposta.
    - Propagar `correlationId` e metadados relevantes.

- **M4. TransactionsModule**
  - Módulo de **gerenciamento de transações** (tentativas junto a PSPs).
  - Componentes:
    - `TransactionsService` — gerencia criação/atualização de `Transaction`.
    - Repositórios (via ORM) de `Transaction`.
  - Responsabilidades:
    - Criar registros de `Transaction` ligados a `Payment`.
    - Atualizar estado das transações conforme resultado do PSP.
    - Expor operações de leitura de transações relevantes para compor respostas.

- **M5. IdempotencyModule**
  - Módulo dedicado à **idempotência de criação de pagamento**.
  - Componentes:
    - `IdempotencyService`.
    - Abstrações de storage (DB/Redis) para chaves de idempotência.
  - Responsabilidades:
    - Receber `Idempotency-Key` + contexto de tenant/cliente.
    - Verificar se existe `Payment` previamente associado àquela chave.
    - Detectar replays compatíveis vs. conflitos de payload.
    - Registrar novos vínculos `Idempotency-Key -> paymentId / hash de payload`.
    - Trabalhar em conjunto com DB e Redis (quando houver) para consistência e performance.

- **M6. ProvidersModule**
  - Módulo de abstração de **PSPs**.
  - Componentes:
    - `ProvidersService` ou `ProviderGateway`.
    - Adapters específicos de PSP (ex.: `MockPspClient` neste baseline).
  - Responsabilidades:
    - Expor método interno estável (ex.: `processPayment(request)`) para o domínio.
    - Traduzir chamadas internas para o contrato do PSP.
    - Traduzir respostas do PSP em modelos internos (`Transaction`), incluindo erros técnicos.

- **M7. SharedModule / ObservabilityModule**
  - Módulo para cross-cutting concerns.
  - Componentes:
    - Interceptors (logging, timing, enrich com `correlationId`).
    - Filtros de exceção (`ExceptionFilter`) para aplicar o padrão `{ code, message, details?, correlationId }`.
    - Middlewares (`CorrelationIdMiddleware`, etc.).
  - Responsabilidades:
    - Garantir logging estruturado por requisição.
    - Capturar e normalizar exceções da aplicação.
    - Propagar `correlationId` e eventualmente métricas.

- **M8. PersistenceModule (ou DatabaseModule)**
  - Módulo para integração com o banco de dados.
  - Componentes:
    - Configuração do ORM (TypeORM).
    - Repositórios de `Payment` e outros agregados necessários.
  - Responsabilidades:
    - Expor repositórios tipados para `PaymentsModule`, `TransactionsModule`, `IdempotencyModule`.
    - Encapsular detalhes das entidades e migrations.

- **M9. CacheModule (ou IdempotencyStoreModule)**
  - Módulo para integração com Redis/Cache.
  - Componentes:
    - Client Redis configurado.
    - Serviços utilitários para leitura/escrita de chaves de idempotência e rate limiting.
  - Responsabilidades:
    - Fornecer operações de cache para `IdempotencyModule` e outros módulos.
    - Implementar locking simples baseado em TTL.

### 2. Integrações (HTTP / DB / Cache) em alto nível

- **Entre módulos internos**
  - `PaymentsModule`:
    - Usa `AuthModule` via guards para proteger endpoints.
    - Usa `IdempotencyModule` para verificar/reutilizar resultados de criação de pagamento.
    - Usa `TransactionsModule` para criar/atualizar transações.
    - Usa `ProvidersModule` para falar com PSP.
    - Usa `PersistenceModule` para persistir `Payment`.
    - Usa `Shared/ObservabilityModule` para logging, correlation-id e tratamento de exceções.

- **Com infraestrutura**
  - `PersistenceModule` → DB (C3).
  - `CacheModule` / `IdempotencyModule` → Redis (C4).
  - `ProvidersModule` → PSP Mock (C5).
  - `AuthModule` → Provider de Identidade (C6).
  - `Shared/ObservabilityModule` → Stack de Observabilidade (C7).

### 3. Boundaries e responsabilidades por componente (resumido)

- **PaymentsModule**
  - Boundary do **caso de uso de pagamento**.
  - Responsável pela orquestração do fluxo de criação/consulta.
  - Não conhece detalhes de DB, cache ou PSP — usa serviços especializados.

- **TransactionsModule**
  - Boundary de **gerenciamento de tentativas/transactions**.
  - Responsável por refletir o histórico de tentativas com PSPs.
  - Fornece dados agregados para compor respostas.

- **IdempotencyModule**
  - Boundary de **idempotência**.
  - Responsável por:
    - Regra de 1:1 entre `Idempotency-Key` e `paymentId` por tenant.
    - Detecção de replay compatível vs. conflito.
  - Não expõe endpoints HTTP; é usado por `PaymentsModule`.

- **ProvidersModule**
  - Boundary de **integração com PSPs**.
  - Esconde detalhes de auth, endpoints, formatos do PSP.

- **AuthModule**
  - Boundary de **segurança**.
  - Responsável por decidir se o chamador pode executar a operação (guards).

- **Shared/ObservabilityModule**
  - Boundary de **cross-cutting**.
  - Responsável por logging, tratamento de exceções e `correlationId`.

- **PersistenceModule / CacheModule**
  - Boundaries de **infraestrutura**.
  - Responsáveis por acesso a DB e cache, respectivamente.

### 4. Como os 3 fluxos atravessam os componentes

#### 4.1. Fluxo: Criar pagamento (`POST /payments`)

**Passo a passo textual (componentes Nest)**

1. **Cliente da API**
   - Envia `POST /payments` com:
     - Headers: `Authorization`, `Idempotency-Key`, `X-Correlation-Id?`.
     - Body: `payer`, `payee`, `amount`, `currency`, `paymentMethod`, `externalReference`, etc.

2. **AppModule + Shared/ObservabilityModule**
   - Middleware captura ou gera `correlationId` e o anexa ao contexto.
   - A requisição é roteada para `PaymentsController`.

3. **AuthModule (Guard)**
   - Guard de autenticação/autorização valida o `Authorization`.
   - Se não autorizado, lança exceção apropriada (`401`/`403`) tratada pelo `ExceptionFilter`.

4. **PaymentsModule — `PaymentsController`**
   - Aplica DTOs e validações (campos obrigatórios, formatos, ranges).
   - Em caso de erro de validação, lança exceção de validação → `ExceptionFilter` converte para `PAYMENT_VALIDATION_ERROR`.
   - Em caso de sucesso, chama `PaymentsService.createPayment(...)`.

5. **PaymentsModule — `PaymentsService`**
   - Normaliza request em um objeto de domínio/proposta de `Payment`.
   - Invoca `IdempotencyService` (em `IdempotencyModule`), passando:
     - `tenant/cliente`, `Idempotency-Key`, subset canônico do payload.

6. **IdempotencyModule — `IdempotencyService`**
   - Consulta `CacheModule` (Redis) para ver se há registro para `(tenant, Idempotency-Key)`.
   - Se necessário, confirma no `PersistenceModule` (DB).
   - Três cenários:
     - **First call**: nenhuma chave encontrada → sinaliza que o fluxo pode seguir com criação.
     - **Replay compatível**: chave existente com payload equivalente → carrega `Payment` existente e devolve ao `PaymentsService` (sem chamar PSP).
     - **Replay conflitante**: chave existente com payload divergente → lança erro de conflito (`PAYMENT_IDEMPOTENCY_CONFLICT`).

7. **PersistenceModule — Repositórios de `Payment`**
   - No cenário de first call:
     - Persiste um novo `Payment` com estado inicial (`CREATED` ou `PENDING`), incluindo `idempotencyKey`, `externalReference`, `tenantId`, `correlationId`.
   - Atualiza a associação `Idempotency-Key -> paymentId` no DB (e opcionalmente no cache).

8. **TransactionsModule — `TransactionsService`**
   - Cria uma nova `Transaction` associada ao `Payment`.
   - Persiste no DB via `PersistenceModule`.

9. **ProvidersModule — `ProvidersService`**
   - Recebe pedido de orquestração de transação.
   - Chama o PSP Mock (contêiner C5), propagando `correlationId` se suportado.
   - Recebe o resultado da tentativa (status/códigos).

10. **TransactionsModule / PersistenceModule**
    - Atualizam a `Transaction` com o resultado do PSP.
    - Atualizam o `Payment` para o estado derivado (ex.: `PENDING` → `AUTHORIZED` ou `FAILED`).

11. **PaymentsModule — `PaymentsService`**
    - Monta DTO de resposta de `Payment`:
      - `paymentId`, `status`, `amount`, `currency`, `payer`, `payee`, `paymentMethod` (mascarado), `externalReference`, `idempotencyKey`, timestamps, `correlationId`.

12. **Shared/ObservabilityModule**
    - `ExceptionFilter` garante formato de erro padrão em caso de falha.
    - Interceptor de logging registra:
      - Rota, método, `tenantId`, `paymentId`, `status`, `errorCode`, latência, `correlationId`.

13. **PaymentsModule — `PaymentsController`**
    - Retorna resposta HTTP:
      - `201 Created` na primeira criação.
      - `200 OK` em replays compatíveis (idempotência).

#### 4.2. Fluxo: Consultar pagamento (`GET /payments/{paymentId}`)

1. **Cliente da API**
   - Envia `GET /payments/{paymentId}` com:
     - `Authorization`.
     - `X-Correlation-Id?`.

2. **AppModule + Shared/ObservabilityModule**
   - Middleware garante presença/propagação de `correlationId`.
   - Request roteado para `PaymentsController`.

3. **AuthModule (Guard)**
   - Valida token e escopo.
   - Se falhar, lança exceção (tratada pelo `ExceptionFilter`).

4. **PaymentsModule — `PaymentsController`**
   - Valida o `paymentId` (formato).
   - Chama `PaymentsService.getPaymentById(...)`.

5. **PaymentsModule — `PaymentsService`**
   - Usa repositórios via `PersistenceModule` para buscar `Payment` e, se necessário, a última `Transaction` relevante (via `TransactionsModule`).
   - Aplica checagem de autorização (tenant/cliente pode ver este pagamento?).

6. **PersistenceModule / TransactionsModule**
   - Executam consultas a DB.
   - Retornam entidades ou indicam não encontrado.

7. **PaymentsService**
   - Se não encontrado:
     - Lança erro `PAYMENT_NOT_FOUND` → `ExceptionFilter` converte para 404.
   - Se encontrado:
     - Mapeia entidades para DTO de resposta (incluindo status atual, timestamps e possivelmente resumo de transações).

8. **Shared/ObservabilityModule**
   - Interceptor registra logs com `correlationId`, `paymentId`, status e latência.

9. **PaymentsController**
   - Retorna 200 com a representação do pagamento, ou erro padronizado.

#### 4.3. Fluxo: Idempotência de pagamento (replay e conflitos)

Focado na lógica transversal de reuso de resultado.

1. **Cliente da API**
   - Reenvia `POST /payments` com mesma `Idempotency-Key` (e, idealmente, mesmo payload de negócio).

2. **AppModule + Shared/ObservabilityModule + AuthModule**
   - Passos idênticos ao fluxo de criação:
     - Correlation-id.
     - Autenticação/autorização.
     - Validação de DTO.

3. **PaymentsModule — `PaymentsService` → IdempotencyModule**
   - Chama `IdempotencyService` com `(tenant, Idempotency-Key, payload canônico)`.

4. **IdempotencyModule — `IdempotencyService`**
   - Consulta `CacheModule` / DB para verificar existência de chave.
   - Dois caminhos principais:
     - **Replay compatível**:
       - Payload atual é equivalente ao armazenado.
       - Carrega `Payment` associado via `PersistenceModule`.
       - Retorna o pagamento ao `PaymentsService` sem chamar `ProvidersModule`.
     - **Replay conflitante**:
       - Payload difere em campos relevantes (`amount`, `currency`, `payee`, etc.).
       - Lança erro `PAYMENT_IDEMPOTENCY_CONFLICT` (409).

5. **PaymentsModule — `PaymentsService`**
   - No replay compatível:
     - Apenas mapeia o `Payment` já existente para DTO.
   - Opcional: marca internamente `idempotencyReplay = true` (metadado).

6. **Shared/ObservabilityModule**
   - Interceptor de logging registra que o fluxo foi atendido via **replay idempotente**, sem nova chamada ao PSP.
   - `ExceptionFilter` trata conflitos (409) e outros erros.

7. **PaymentsController**
   - Retorna:
     - `200 OK` (ou `201` conforme convenção adotada) com o mesmo shape de resposta da primeira chamada, em replays compatíveis.
     - `409 Conflict` com erro padronizado em caso de conflito.

### 5. Diagrama textual de componentes (estilo C4)

- **Componentes (módulos Nest)**
  - `M1: AppModule` — composição e configuração global.
  - `M2: AuthModule` — autenticação/autorização.
  - `M3: PaymentsModule` — endpoints e orquestração de pagamentos.
  - `M4: TransactionsModule` — gestão de transações junto a PSPs.
  - `M5: IdempotencyModule` — controle de idempotência.
  - `M6: ProvidersModule` — integração com PSP/Provider Mock.
  - `M7: Shared/ObservabilityModule` — logging, tracing, exception filters, middlewares.
  - `M8: PersistenceModule` — integração com banco de dados.
  - `M9: CacheModule` — integração com Redis/Cache.

- **Relações principais**
  - `Cliente da API -> PaymentsModule (via AppModule + AuthModule + Shared)`.
  - `PaymentsModule -> IdempotencyModule`.
  - `PaymentsModule -> TransactionsModule -> ProvidersModule`.
  - `PaymentsModule/TransactionsModule/IdempotencyModule -> PersistenceModule`.
  - `IdempotencyModule -> CacheModule`.
  - `AuthModule -> Provider de Identidade`.
  - `Shared/ObservabilityModule -> Stack de Observabilidade`.
