## C4 — Nível 3: Visão de Componentes (módulos Nest)

### 1. Escopo

Esta visão detalha **os principais componentes internos da `Payment Hub API`**, representados como **módulos NestJS** (e alguns componentes relevantes dentro deles), e como eles colaboram para suportar os três fluxos principais:
- Criar pagamento.
- Consultar pagamento.
- Idempotência de pagamento.

### 2. Componentes principais (módulos Nest)

- **M1. AppModule**
  - Módulo raiz do NestJS.
  - Responsabilidades:
    - Compor os módulos de domínio e infraestrutura (`PaymentsModule`, `ProvidersModule`, `PersistenceModule`, etc.).
    - Configurar middlewares globais (ex.: extração de `X-Correlation-Id`).

- **M2. PaymentsModule**
  - Módulo de domínio principal de pagamentos.
  - Contém (em linhas gerais):
    - `PaymentsController` — endpoints REST (`POST /payments`, `GET /payments/...`).
    - `PaymentsService` — orquestra regras de negócio de pagamento.
  - Responsabilidades:
    - Expor as rotas públicas de pagamento.
    - Validar entradas usando DTOs/pipes.
    - Invocar serviços de idempotência, repositórios e providers.
    - Mapear entidades de domínio para DTOs de resposta.

- **M3. IdempotencyModule**
  - Módulo dedicado à lógica de idempotência.
  - Contém:
    - `IdempotencyService`.
    - Repositórios/entidades de suporte (chaves de idempotência, locks, etc.) ou integrações com o `PersistenceModule`.
  - Responsabilidades:
    - Validar e registrar `Idempotency-Key`.
    - Verificar se já existe um `payment` associado à mesma chave.
    - Evitar chamadas duplicadas ao PSP em cenário de replay.

- **M4. ProvidersModule**
  - Módulo responsável pela integração com provedores/PSPs.
  - Contém:
    - `ProviderClient` / `ProviderService` (abstração principal).
    - Adapters por PSP específico (em versões futuras).
  - Responsabilidades:
    - Oferecer uma interface interna estável para o domínio (`PaymentsService`).
    - Encapsular detalhes de autenticação, endpoints e formatos do PSP.
    - Traduzir respostas do PSP para um modelo interno de `transaction`.

- **M5. PersistenceModule (DatabaseModule / InfraModule)**
  - Módulo de acesso a dados.
  - Provê:
    - Configuração do ORM (TypeORM ou similar).
    - Repositórios para `payment` e `transaction`.
  - Responsabilidades:
    - Persistir e consultar entidades de domínio.
    - Garantir transações e consistência nas operações de escrita.

- **M6. ObservabilityModule**
  - Módulo relacionado a logging, tracing, métricas básicas.
  - Contém:
    - Interceptors de logging com `correlationId`.
    - Providers para integração com stack de logs.
  - Responsabilidades:
    - Registrar logs estruturados por requisição.
    - Propagar `correlationId` em toda a pilha de chamadas internas.

- **M7. AuthModule (futuro/pré-reservado)**
  - Módulo para autenticação/autorização via JWT (a ser implementado em etapas posteriores).
  - Responsabilidades:
    - Validar tokens JWT.
    - Expor guards usados nos controllers de pagamento.

### 3. Relações entre módulos (alto nível)

- `AppModule`
  - **Importa** `PaymentsModule`, `ProvidersModule`, `PersistenceModule`, `IdempotencyModule`, `ObservabilityModule`, `AuthModule`.
  - Aplica middlewares globais (ex.: captura de `X-Correlation-Id`).

- `PaymentsModule`
  - **Depende de**:
    - `IdempotencyModule` (para verificar/reutilizar resultados de pagamentos).
    - `PersistenceModule` (para salvar/consultar `payment` e `transaction`).
    - `ProvidersModule` (para chamar o PSP).
    - `ObservabilityModule` (para logging com `correlationId`).
    - `AuthModule` (futuro, para proteger endpoints).

- `IdempotencyModule`
  - **Depende de**:
    - `PersistenceModule` (armazenar chaves e estado associado).
  - **É usado por**:
    - `PaymentsModule` para proteger o fluxo de criação de pagamentos.

- `ProvidersModule`
  - **É usado por**:
    - `PaymentsModule` para interação com o PSP.
  - Pode depender do `ObservabilityModule` para logging de integrações externas.

- `PersistenceModule`
  - **É usado por**:
    - `PaymentsModule` (repositórios de `payment` e `transaction`).
    - `IdempotencyModule` (armazenamento de idempotência).

- `ObservabilityModule`
  - **É usado por**:
    - Módulos de aplicação (especialmente `PaymentsModule` e `ProvidersModule`).

### 4. Sequência de componentes por fluxo

#### 4.1. Fluxo: Criar pagamento (`POST /payments`)

**Sequência de componentes (texto)**

1. **Cliente da API**
   - Envia `HTTP POST /payments` para a `Payment Hub API` com:
     - `Idempotency-Key`.
     - `X-Correlation-Id`.
     - Dados do pagamento (valor, moeda, método, `businessKey` etc.).

2. **AppModule + ObservabilityModule**
   - Middleware/Interceptor global captura ou gera `correlationId`.
   - Request é roteado para o `PaymentsController` dentro do `PaymentsModule`.

3. **PaymentsModule — `PaymentsController`**
   - Recebe a requisição.
   - Aplica validações de DTOs e pipes.
   - Encaminha para o `PaymentsService`.

4. **PaymentsModule — `PaymentsService`**
   - Orquestra o fluxo de criação de pagamento:
     - Chama o `IdempotencyService` (em `IdempotencyModule`) passando `Idempotency-Key` e contexto de negócio.

5. **IdempotencyModule — `IdempotencyService`**
   - Usa repositórios do `PersistenceModule` para consultar se já existe `payment` associado àquela `Idempotency-Key` (e/ou combinação com `businessKey`).
   - **Se existir**:
     - Retorna o `payment` já existente (sem chamar o PSP).
   - **Se não existir**:
     - Cria um registro de intenção de pagamento (pode delegar ao `PaymentsService` + repositórios) e marca a chave como em uso.

6. **PersistenceModule — Repositórios**
   - Persistem:
     - Novo `payment` com estado inicial (`PENDING`) e metadados (`Idempotency-Key`, `businessKey`, `correlationId`).
     - Nova `transaction` associada ao PSP a ser chamado.

7. **PaymentsModule — `PaymentsService` → ProvidersModule**
   - `PaymentsService` chama `ProviderService` (dentro do `ProvidersModule`) para enviar a requisição ao PSP.

8. **ProvidersModule — `ProviderService` / Adapter**
   - Monta a chamada ao PSP (HTTP ou simulado).
   - Propaga `correlationId` em headers ou metadados.
   - Recebe resposta do PSP com o status da transação.

9. **PersistenceModule — Repositórios**
   - Atualizam a `transaction` com o resultado retornado pelo PSP.
   - Atualizam o `payment` para o estado derivado (ex.: `AUTHORIZED`, `DECLINED`, `FAILED`, `PENDING`).

10. **PaymentsModule — `PaymentsService`**
    - Monta o modelo de resposta de **payment** para o mundo externo.

11. **PaymentsModule — `PaymentsController`**
    - Retorna resposta HTTP (status 201 na primeira criação, ou 200 em replays idempotentes), incluindo:
      - Estado atual do pagamento.
      - Metadados principais (valor, método, `businessKey`).
      - `correlationId`.

12. **ObservabilityModule**
    - Interceptor de resposta registra logs estruturados do fluxo completo, associando-os ao `correlationId`.

#### 4.2. Fluxo: Consultar pagamento (`GET /payments/{id}` ou por `businessKey`)

**Sequência de componentes (texto)**

1. **Cliente da API**
   - Envia `HTTP GET /payments/{paymentId}` (ou rota equivalente) para a `Payment Hub API`, com `X-Correlation-Id`.

2. **AppModule + ObservabilityModule**
   - Middleware/Interceptor global garante que o `correlationId` está presente.
   - Request é roteado para o `PaymentsController`.

3. **PaymentsModule — `PaymentsController`**
   - Recebe a requisição de consulta.
   - Valida parâmetros de rota/query.
   - Invoca o `PaymentsService`.

4. **PaymentsModule — `PaymentsService`**
   - Usa repositórios do `PersistenceModule` para:
     - Buscar o `payment` pelo `paymentId` ou `businessKey`.
     - Opcionalmente buscar a última `transaction` relevante.

5. **PersistenceModule — Repositórios**
   - Executam consultas no banco de dados.
   - Retornam entidades de `payment` e `transaction` (se existirem).

6. **PaymentsModule — `PaymentsService`**
   - Se o pagamento não for encontrado:
     - Lança exceção de domínio traduzida depois para erro HTTP 404.
   - Se encontrado:
     - Mapeia modelo interno para DTO de resposta (valores, estado, transações relevantes).

7. **PaymentsModule — `PaymentsController`**
   - Retorna resposta HTTP (200) ou, em caso de exceção, delega ao filtro de exceções global.

8. **ObservabilityModule**
   - Registra logs de sucesso/erro vinculados ao `correlationId`.

#### 4.3. Fluxo: Idempotência de pagamento (reuso de resultado)

Este fluxo é transversal, mas pode ser descrito como uma **variação do fluxo de criação** em que a chave de idempotência já foi usada.

**Sequência de componentes (texto)**

1. **Cliente da API**
   - Reenvia `HTTP POST /payments` com a **mesma** `Idempotency-Key` e os mesmos dados de negócio (ou compatíveis).

2. **AppModule + ObservabilityModule**
   - Fluxo de entrada igual ao fluxo de criação:
     - Captura `correlationId`.
     - Roteia para `PaymentsController`.

3. **PaymentsModule — `PaymentsController`**
   - Valida o payload.
   - Encaminha para `PaymentsService`.

4. **PaymentsModule — `PaymentsService` → IdempotencyModule**
   - Chama `IdempotencyService` com a `Idempotency-Key`.

5. **IdempotencyModule — `IdempotencyService`**
   - Usa `PersistenceModule` para:
     - Verificar se já existe `payment` vinculado àquela `Idempotency-Key`.
   - **Como o pagamento já existe**:
     - Recupera o `payment` correspondente (e suas transações).
     - **Não** chama o `ProvidersModule` (não há nova ida ao PSP).

6. **PaymentsModule — `PaymentsService`**
   - Recebe o `payment` já existente da camada de idempotência.
   - Mapeia para DTO de resposta.

7. **PaymentsModule — `PaymentsController`**
   - Retorna a resposta HTTP:
     - Status 200 (recomendado) indicando que é o mesmo recurso.
     - Corpo equivalente ao da criação inicial bem-sucedida.

8. **ObservabilityModule**
   - Registra o fato de que a requisição foi tratada como **replay idempotente** (sem nova chamada ao PSP), sempre vinculado ao novo `correlationId` desta requisição.

### 5. Diagrama textual de componentes (estilo C4)

- **Componentes (módulos Nest)**
  - `M1: AppModule` — módulo raiz e composição.
  - `M2: PaymentsModule` — domínio de pagamentos (controllers + services).
  - `M3: IdempotencyModule` — lógica de idempotência.
  - `M4: ProvidersModule` — integração com PSPs.
  - `M5: PersistenceModule` — acesso ao banco de dados.
  - `M6: ObservabilityModule` — logging e correlation-id.
  - `M7: AuthModule` — autenticação/autorização (futuro).

- **Relações principais**
  - `Cliente da API -> PaymentsModule (via AppModule)`: chamadas HTTP para criação/consulta de pagamentos.
  - `PaymentsModule -> IdempotencyModule`: verificação e controle de `Idempotency-Key`.
  - `PaymentsModule -> PersistenceModule`: persistência e consulta de `payment` e `transaction`.
  - `PaymentsModule -> ProvidersModule`: envio de requisições ao PSP.
  - `AppModule/PaymentsModule -> ObservabilityModule`: logging de requests/responses com `correlationId`.
  - `PaymentsModule -> AuthModule` (futuro): proteção de endpoints de pagamento.

