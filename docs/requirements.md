# Requirements — Payment Hub API

## Context Pack

### Objetivo

Centralizar e padronizar a orquestração de pagamentos através de uma API REST NestJS, com foco em criação/consulta de pagamentos, idempotência e rastreabilidade via correlation-id.

### Escopo IN

- Criação e consulta de pagamentos.
- Modelo mínimo de `payment` e `transaction`.
- Abstração de `provider/psp`.
- Idempotência baseada em `Idempotency-Key`.
- Padrão de erro unificado e uso de `X-Correlation-Id`.

### Escopo OUT

- Gestão de usuários.
- Backoffice UI.
- Reconciliação financeira avançada.
- Integrações reais com múltiplos PSPs específicos.
- Múltiplas moedas complexas.
- Motor sofisticado de roteamento.
- Monitoramento avançado.
- Segurança avançada.

### Fluxos principais

- **Criar pagamento**: validação → verificação de idempotência → criação de `payment` e `transaction` → chamada ao PSP → atualização de estado → resposta 201/200.
- **Consultar pagamento**: busca por `paymentId`, por `externalReference` no escopo do cliente ou por chave de idempotência (`GET /v1/payments/by-idempotency-key/{idempotencyKey}`); retorno 200 ou erro 404 padronizado. Ver [OpenAPI](api/openapi.md) para os endpoints versionados.
- **Idempotência de pagamento**: uso de `Idempotency-Key` + `businessKey` → reutilização do resultado da primeira chamada → ausência de chamadas redundantes ao PSP.

### Glossário

| Termo | Definição |
|-------|-----------|
| **payment** | Intenção de pagamento com estado de processamento. |
| **transaction** | Tentativa de processamento com um PSP específico. |
| **provider/psp** | Provedor externo de processamento de pagamento. |
| **idempotency-key** | Chave única para garantir não duplicação de pagamentos. |
| **business key** | Identificador de negócio externo (ex.: pedido). |
| **correlation-id** | Identificador técnico de rastreio ponta a ponta. |

### Convenções de API

- **Headers**: `Idempotency-Key` (criação), `X-Correlation-Id` (rastreio).
- **Padrão de erro**: objeto `{ code, message, details?, correlationId }` com taxonomia interna de `code`.
- **Status codes**: 200/201 para sucesso; 4xx para erros de cliente (400, 401, 403, 404, 409, 422, 429); 5xx para erros de servidor (500, 502/503 opcionais).
- **Códigos de erro sugeridos** para 401/403/429/500/503: `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID`, `AUTH_INSUFFICIENT_PERMISSION`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.

### Trilho NestJS

Modules → DTO/Validation/Pipes/Middlewares → TypeORM → Services → Controllers → Exception Filters → Interceptors → Guards → Auth JWT.

### Pronto para C4 quando

- Domínio mínimo e glossário definidos.
- Fluxos de criar/consultar pagamento e idempotência mapeados.
- Contratos de API em alto nível esclarecidos (rotas, headers, status).
- Convenções técnicas (erros, correlation-id, idempotência) documentadas.
- Ordem de implementação em NestJS acordada.

---

## Requisitos funcionais

### 1. Fluxo — Criar pagamento

- **Objetivo**  
  Registrar um novo pagamento no Payment Hub, garantindo consistência da intenção de pagamento, aplicação de regras de negócio básicas e preparo para orquestração com provedores externos.

- **Entradas (body/query/headers)**  
  - **Headers**  
    - `Authorization`: token de autenticação do cliente (obrigatório).  
    - `Idempotency-Key`: chave idempotente fornecida pelo cliente, única por combinação de negócio em uma janela de tempo (obrigatório para criação).  
    - `X-Correlation-Id`: identificador de correlação para rastreio ponta a ponta (opcional; gerado pelo hub se ausente).  
  - **Query params**  
    - Nenhum obrigatório; apenas parâmetros futuros (ex.: `mode=async|sync`) poderão ser adicionados.  
  - **Body (JSON)**  
    - **Identificação do pagador**  
      - `payer.id` ou `payer.externalId` (obrigatório – chave de referência do cliente).  
    - **Identificação do favorecido**  
      - `payee.id` ou `payee.externalId` (obrigatório).  
    - **Montante e moeda**  
      - `amount` (obrigatório, > 0).  
      - `currency` (obrigatório, ex.: `BRL`, `USD`).  
    - **Meio de pagamento / canal**  
      - `paymentMethod.type` (ex.: `PIX`, `CARD`, `BOLETO`, etc.).  
      - Campos específicos por tipo (ex.: chave PIX, dados de cartão tokenizados, etc.).  
    - **Metadados e referências externas**  
      - `externalReference` (opcional; referência do sistema chamador).  
      - `callbackUrl` (opcional; notificação assíncrona).  
      - `metadata` (opcional; mapa chave/valor).  

- **Validações essenciais**  
  - **Autenticação e autorização**  
    - `Authorization` válido e com escopo para criar pagamentos.  
  - **Idempotência**
    - `Idempotency-Key` presente, não vazio, com tamanho máximo de 128 caracteres.
    - Escopo da chave: **cliente autenticado** (identidade/escopo extraído do token). Para mesma `Idempotency-Key` no mesmo escopo, retornos consistentes conforme regras do fluxo de idempotência. (Evolução futura: multi-tenant com `tenantId` explícito.)  
  - **Body**  
    - Campos obrigatórios presentes (`payer`, `payee`, `amount`, `currency`, `paymentMethod.type`).  
    - `amount > 0`.  
    - `currency` suportada pelo hub (lista mínima documentada: ex.: `BRL`, `USD`; ver openapi/requirements para lista completa).  
    - Consistência entre `paymentMethod.type` e campos específicos (ex.: chave PIX obrigatória se tipo = `PIX`).  
  - **Regras de negócio mínimas**  
    - Pagador e favorecido não podem ser a mesma entidade em cenários que o contexto proíba (ex.: PIX entre contas diferentes obrigatórias).  
    - Verificação básica de limites (ex.: limite diário por cliente, se já existir contador).  
    - Verificação de duplicidade óbvia por business key (ver seção de invariantes).  

- **Processamento (alto nível)**  
  - **1. Criação de intenção de pagamento**  
    - Normaliza request (objetos `payer`/`payee` da API → `customerId`/`merchantId` no modelo interno) e monta entidade interna `Payment`.  
    - Gera `paymentId` interno único. Estado inicial persistido: `INITIATED` (ainda não enviado ao provedor) ou `PENDING` (já enviado); na resposta da API expõe-se o equivalente: `CREATED` ou `PENDING` (ver [data-state.md](data-state.md) para mapeamento completo interno ↔ API).  
    - Persiste registro com: dados do pagamento, `Idempotency-Key`, `businessKey`, timestamps e `correlationId`.  
  - **2. Aplicação de regras de negócio síncronas mínimas**  
    - Checa limites, bloqueios simples (ex.: cliente bloqueado, merchant desabilitado).  
    - Se falhar, marca pagamento como `FAILED` com razão clara.  
  - **3. Disparo de orquestração (se aplicável ao MVP)**  
    - Opcionalmente publica evento ou agenda job para integração com provedor externo.  
  - **4. Resposta ao chamador**  
    - Sempre retorna representação do recurso `Payment` (estado atual na linguagem da API: `CREATED`, `PENDING`, `FAILED`, etc., não necessariamente final).  

- **Saídas (response)**  
  - **Body (JSON)** – sucesso (201)  
    - `paymentId`  
    - `status` (ex.: `CREATED`, `PENDING`, `FAILED`)  
    - `amount`, `currency`  
    - `payer`, `payee`  
    - `paymentMethod` (mascarado/seguro)  
    - `externalReference`  
    - `createdAt`, `updatedAt`  
    - `idempotencyKey`  
    - `correlationId`  
  - **Body (JSON)** – erro  
    - `{ "code": string, "message": string, "details"?: object, "correlationId": string }`  

- **Status codes possíveis**  
  - **201 Created**: pagamento criado com sucesso (intenção registrada).  
  - **400 Bad Request**: payload inválido (campos obrigatórios ausentes, formatos inválidos).  
  - **401 Unauthorized**: token inválido ou ausente.  
  - **403 Forbidden**: cliente autenticado, mas sem permissão para criar pagamentos.  
  - **409 Conflict**: conflito de idempotência ou duplicidade de negócio.  
  - **422 Unprocessable Entity**: regras de negócio rejeitaram o pagamento (ex.: limite excedido, cliente bloqueado).  
  - **429 Too Many Requests**: rate limit excedido.  
  - **500 Internal Server Error**: erro inesperado interno.  
  - **503 Service Unavailable**: dependência crítica indisponível (ex.: banco ou provedor de pagamento).  

- **Erros padronizados (exemplos)**  
  - **Validação de campos**  
    - `code`: `PAYMENT_VALIDATION_ERROR`  
    - `message`: `"Dados de pagamento inválidos."`  
    - `details`: `{ "fieldErrors": [ { "field": "amount", "error": "MUST_BE_POSITIVE" } ] }`  
  - **Idempotência — requisição repetida compatível**
    - Primeira criação → **201 Created**; replay compatível (mesma `Idempotency-Key` e mesmo payload) → **200 OK** com mesma representação do pagamento (sem erro).
  - **Idempotência — conflito**  
    - `code`: `PAYMENT_IDEMPOTENCY_CONFLICT`  
    - `message`: `"Conflito de idempotência: requisição incompatível com chamada anterior."`  
    - `details`: `{ "idempotencyKey": "..." }`  
  - **Regra de negócio rejeitada**  
    - `code`: `PAYMENT_BUSINESS_RULE_VIOLATION`  
    - `message`: `"Pagamento não autorizado pelas regras de negócio."`  

### 2. Fluxo — Consultar pagamento

- **Objetivo**  
  Recuperar o estado atual e os dados principais de um pagamento previamente criado, de forma consistente e segura.

- **Entradas (body/query/headers)**  
  - **Headers**  
    - `Authorization` (obrigatório).  
    - `X-Correlation-Id` (opcional).  
  - **Path params**  
    - `paymentId` (obrigatório) **ou** outro identificador definido no contexto (ex.: `externalReference` + cliente).  
  - **Query params** (opcionais)  
    - `expand=` (ex.: `expand=events,history` para detalhes mais ricos, conforme evolução).  

- **Validações essenciais**  
  - Autenticação e autorização do cliente.  
  - Verificar se o cliente autenticado tem acesso ao `paymentId` solicitado (escopo do token; em evolução: multi-tenant).  
  - Validação de formato do `paymentId`.  

- **Processamento (alto nível)**  
  - Localiza o pagamento pelo identificador (índice por `paymentId`, por `externalReference` no escopo do cliente, ou por chave de idempotência — ver endpoint `GET /v1/payments/by-idempotency-key/{idempotencyKey}`).  
  - Aplica filtros de autorização (o cliente autenticado pode ver este pagamento?).  
  - Monta DTO de resposta na linguagem da API (`payer`, `payee`, `status` exposto) a partir do modelo interno; inclui status atual e últimos timestamps relevantes.  
  - Opcionalmente agrega dados de eventos de status (se `expand` solicitado e suportado).  

- **Saídas (response)**  
  - **Body (JSON)** – sucesso (200)  
    - `paymentId`  
    - `status` (vocabulário da API: `CREATED`, `PENDING`, `AUTHORIZED`, `SETTLED`, `FAILED`, `CANCELLED` — mapeado do estado interno; ver data-state.md)  
    - `amount`, `currency`  
    - `payer`, `payee` (objetos do contrato da API; montados a partir de `customerId`/`merchantId` internos)  
    - `paymentMethod` (mascarado)  
    - `externalReference`  
    - `createdAt`, `updatedAt`, `completedAt` (quando existir)  
    - `correlationId` (último correlacionado ou o da criação)  
  - **Body (JSON)** – erro  
    - `{ "code", "message", "details"?, "correlationId" }`  

- **Status codes possíveis**  
  - **200 OK**: pagamento encontrado.  
  - **400 Bad Request**: identificador em formato inválido.  
  - **401 Unauthorized**: token inválido ou ausente.  
  - **403 Forbidden**: cliente não tem acesso ao pagamento.  
  - **404 Not Found**: pagamento não encontrado.  
  - **429 Too Many Requests**: rate limit excedido.  
  - **500 Internal Server Error**: erro inesperado.  

- **Erros padronizados (exemplos)**  
  - **Pagamento não encontrado**  
    - `code`: `PAYMENT_NOT_FOUND`  
    - `message`: `"Pagamento não encontrado."`  
    - `details`: `{ "paymentId": "..." }`  
  - **Acesso negado**  
    - `code`: `PAYMENT_ACCESS_DENIED`  
    - `message`: `"Você não tem acesso a este pagamento."`  

### 3. Fluxo — Idempotência de pagamento (replay e conflitos)

- **Objetivo**  
  Garantir que múltiplas chamadas de criação de pagamento (retries, reenvios ou problemas de rede) não resultem em múltiplas intenções inconsistentes, preservando a semântica "uma intenção de pagamento por chave idempotente".

- **Entradas relacionadas**  
  - `Idempotency-Key` no header de criação de pagamento.  
  - Parâmetros usados para compor a **business key** (ver invariantes).  

- **Validações essenciais**  
  - `Idempotency-Key` não pode ser vazio e deve atender formato/tamanho máximo (ex.: 128 caracteres).  
  - Escopo: **cliente autenticado** (identidade/escopo do token). A combinação (escopo do cliente, `Idempotency-Key`) deve ser única durante a janela de retenção configurada. (Multi-tenant: evolução futura com `tenantId` explícito.)  
  - Na repetição de requisição com mesma `Idempotency-Key`, comparar payload relevante com registro anterior (para detectar conflito).  

- **Processamento (alto nível)**  
  - **1. Recepção da requisição de criação**  
    - Gera/recebe `correlationId`.  
    - Busca se já existe registro para (escopo do cliente autenticado, `Idempotency-Key`).  
  - **2. Comportamento em caso de "first call"**  
    - Não existe registro → cria pagamento normalmente, liga `Idempotency-Key` ao `paymentId` e persiste.  
    - Armazena também o "hash" ou subconjunto canônico do payload de negócio para comparação futura.  
  - **3. Comportamento em caso de "replay compatível"**  
    - Registro encontrado para mesma `Idempotency-Key`.  
    - Payload atual é equivalente ao payload canônico armazenado.  
    - Retorna a mesma representação do pagamento já criado (201/200) sem criar novos registros.  
    - Garante que o estado do pagamento não seja alterado indevidamente por causa do replay.  
  - **4. Comportamento em caso de "replay conflitante"**  
    - Registro encontrado, mas payload atual difere em campos relevantes (ex.: `amount`, `currency`, `payee`).  
    - Não altera o pagamento já existente.  
    - Retorna erro `409 Conflict` com payload de erro padronizado.  

- **Saídas (response)**  
  - Em caso de replay compatível:  
    - Mesmo shape de sucesso do fluxo "Criar pagamento".  
    - Pode incluir campo adicional de metadado: `idempotencyReplay: true` (se o contexto desejar).  
  - Em caso de conflito:  
    - `{ "code", "message", "details"?, "correlationId" }`  

- **Status codes possíveis**
  - **201 Created**: primeira criação com sucesso.
  - **200 OK**: replay compatível (mesma Idempotency-Key e mesmo payload; retorna o pagamento já criado).
  - **400 Bad Request**: `Idempotency-Key` ausente ou inválida quando obrigatória.  
  - **409 Conflict**: `Idempotency-Key` já usada com payload diferente.  
  - **500 Internal Server Error**: falha em verificar/registrar idempotência.  

- **Erros padronizados (exemplos)**  
  - **Chave idempotente ausente**  
    - `code`: `IDEMPOTENCY_KEY_REQUIRED`  
    - `message`: `"Cabeçalho Idempotency-Key é obrigatório para este recurso."`  
  - **Conflito de idempotência**  
    - `code`: `PAYMENT_IDEMPOTENCY_CONFLICT`  
    - `message`: `"Conflito de idempotência com requisição anterior."`  
    - `details`: `{ "idempotencyKey": "...", "existingPaymentId": "..." }`  

## Requisitos não funcionais

- **Observabilidade**  
  - Logs estruturados com: `correlationId`, `paymentId`, escopo do cliente, `status`, `errorCode` (quando houver).  
  - Métricas mínimas:  
    - Contador de pagamentos criados por status final.  
    - Latência de criação e consulta.  
    - Contador de erros por `code`.  
  - Traços (tracing):  
    - Propagação de `X-Correlation-Id` / trace-id para serviços downstream (quando existirem).  

- **Consistência**  
  - Escritas de criação de pagamento devem ser fortemente consistentes no armazenamento primário (o `paymentId` retornado deve sempre existir e ser consultável em seguida).  
  - Notificações e integrações externas podem ser eventualmente consistentes, desde que o estado interno seja a fonte de verdade.  

- **Segurança**  
  - Comunicação somente sobre TLS (HTTPS).  
  - Autenticação obrigatória via esquema padronizado (ex.: OAuth2/JWT), de acordo com o Context Pack.  
  - Autorização por escopo/role (escopo do cliente autenticado; evolução: multi-tenant).  
  - Dados sensíveis (ex.: dados de cartão) nunca são retornados em claro, apenas tokens/aliases.  
  - Logs não podem registrar dados confidenciais (apenas identificadores ou versões mascaradas).  

- **Performance e resiliência**  
  - Latência média aceitável para criação e consulta (ex.: P95 < X ms para MVP, definido no contexto).  
  - Rate limiting por cliente para proteção do hub.  
  - Timeouts razoáveis para integrações externas; em caso de falha, o estado interno deve refletir claramente a situação (`PENDING` vs `FAILED`).  

- **Regras, invariantes e modelo de estados**  
  - Para o **modelo conceitual completo** de entidades, state machines e idempotência (Payment, Transaction, IdempotencyRecord, ProviderConfig, EventLog; transições de estado; replay e conflitos), ver **[Modelo de Dados & Estado](data-state.md)**.
  - **Idempotency-Key**  
    - Obrigatória para criação de pagamento.  
    - Escopo: única por (cliente autenticado / escopo do token, `Idempotency-Key`) em janela configurável (ex.: N dias). Associada 1:1 a um `paymentId`. Evolução: multi-tenant com `tenantId`.  
  - **Business key de pagamento (conceito)**  
    - Combinação lógica que identifica uma "intenção" de pagamento, por exemplo: escopo do cliente, `payer`/`payee` (ou `customerId`/`merchantId` internos), `amount`, `currency`, `externalReference`.  
    - Usada para detecção adicional de duplicidade de negócio (além da `Idempotency-Key`).  
  - **Transição de estado do pagamento (vocabulário da API)**  
    - Estados expostos na API:  
      - `CREATED` — intenção registrada, ainda não enviada ao provedor (equivalente interno: `INITIATED`).  
      - `PENDING` — em processamento junto ao provedor.  
      - `AUTHORIZED` — valor autorizado, ainda não liquidado.  
      - `SETTLED` — pagamento concluído com sucesso (equivalente interno: `CAPTURED`).  
      - `FAILED` — falha irrecuperável.  
      - `CANCELLED` — cancelado após criação.  
    - Invariantes de transição:  
      - Não é permitido voltar de um estado final (`SETTLED`, `FAILED`, `CANCELLED`) para estados anteriores.  
      - Alterações de `amount` e `currency` não são permitidas após `AUTHORIZED` (ou outro marco definido).  
      - Requisição idempotente de criação não altera estado, apenas retorna o atual.
