# Modelo de Dados & Estado — Payment Hub API

Este documento descreve o **modelo conceitual de dados e estado** do Payment Hub API (simplificado), alinhado aos três fluxos principais e ao C4 Component.

---

## 1. Entidades conceituais

### 1.1. `Payment` (Pagamento)

- **Descrição**: Representa a intenção de pagamento em nível de negócio (ex.: cobrança de uma fatura, pedido, assinatura).
- **Campos essenciais**
  - `id` (UUID): identificador técnico do pagamento.
  - `businessReference` (string): referência de negócio (ex.: `invoiceId`, `orderId`).
  - `amount` (decimal): valor total do pagamento.
  - `currency` (string, ISO 4217): moeda (ex.: `BRL`, `USD`).
  - `status` (enum): estado atual do pagamento (ex.: `PENDING`, `AUTHORIZED`, `CAPTURED`, `CANCELLED`, `FAILED`).
  - `customerId` (string): identificação do cliente no domínio do hub ou do sistema origem.
  - `merchantId` (string): identificação do comerciante/estabelecimento.
  - `providerId` (string): identificação do provedor de pagamento selecionado (ex.: PSP, gateway).
  - `createdAt` (datetime): data/hora de criação.
  - `updatedAt` (datetime): data/hora de última atualização.
  - `metadata` (JSON genérico): informações adicionais não estruturadas (tags de negócio, notas, etc.).
- **Chaves/uniques e índices conceituais**
  - Chave primária: `id`.
  - Unique de negócio opcional: (`merchantId`, `businessReference`) para evitar pagamentos duplicados para a mesma referência de negócio.
  - Índices:
    - Índice em `status` para consultas por estado.
    - Índice composto em (`merchantId`, `createdAt`) para relatórios e consultas por período/merchant.
- **Relacionamentos**
  - 1:N com `Transaction`: um `Payment` possui uma ou mais `Transaction` (ex.: tentativas/reprocessos).
  - 1:1/N com `IdempotencyRecord`: várias requisições idempotentes podem apontar para o mesmo `Payment`, dependendo do fluxo.

### 1.2. `Transaction` (Transação)

- **Descrição**: Representa uma interação concreta com um provedor de pagamento (ex.: autorização, captura, refund, reprocesso).
- **Campos essenciais**
  - `id` (UUID): identificador técnico da transação.
  - `paymentId` (UUID): referência ao `Payment` associado.
  - `operationType` (enum): tipo de operação (ex.: `AUTHORIZE`, `CAPTURE`, `SALE`, `REFUND`, `VOID`).
  - `status` (enum): estado da transação (ex.: `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `TIMED_OUT`).
  - `providerId` (string): provedor de pagamento utilizado.
  - `providerTransactionId` (string): identificador da transação no provedor.
  - `amount` (decimal): valor processado nesta transação (pode ser total ou parcial).
  - `requestPayload` (JSON): payload enviado ao provedor (sanitizado).
  - `responsePayload` (JSON): resposta original do provedor (sanitizada).
  - `errorCode` (string): código de erro de alto nível (normalizado pelo hub).
  - `errorDetails` (string/JSON): detalhes do erro (mensagem técnica ou raw do provedor).
  - `createdAt` (datetime).
  - `updatedAt` (datetime).
- **Chaves/uniques e índices conceituais**
  - Chave primária: `id`.
  - Unique: (`providerId`, `providerTransactionId`) para garantir unicidade da transação por provedor.
  - Índices:
    - Índice em `paymentId` para recuperar rapidamente o histórico de transações de um pagamento.
    - Índice composto em (`status`, `createdAt`) para filas de reprocesso / monitoração.
- **Relacionamentos**
  - N:1 com `Payment`.
  - Opcionalmente 1:1/N com `IdempotencyRecord` (para mapear requisições diretas de transação, se o fluxo for mais granular).

### 1.3. `IdempotencyRecord` (Registro de Idempotência)

- **Descrição**: Representa o controle de idempotência de requisições recebidas pelo Payment Hub API.
- **Campos essenciais**
  - `id` (UUID): identificador técnico do registro.
  - `idempotencyKey` (string): chave técnica recebida no cabeçalho `Idempotency-Key`.
  - `scope` (string): escopo lógico da key (ex.: `CREATE_PAYMENT`, `CAPTURE_PAYMENT`, `REFUND_PAYMENT`).
  - `businessKey` (string/JSON): chave(s) de negócio associada(s) (ex.: `invoiceId`, ou combinação normalizada).
  - `requestHash` (string): hash determinístico do payload relevante da requisição (corpo + parâmetros + caminho).
  - `status` (enum): estado do registro de idempotência (ex.: `IN_PROGRESS`, `COMPLETED`, `FAILED`, `EXPIRED`).
  - `responseStatusCode` (int): HTTP status code retornado na primeira execução bem-sucedida/terminada.
  - `responseBody` (JSON/string): corpo da resposta serializado para replay.
  - `resourceId` (string): identificador do recurso principal criado/afetado (ex.: `paymentId`).
  - `expiresAt` (datetime): momento em que o registro deixa de ser considerado válido para replay/confirmação.
  - `createdAt` (datetime).
  - `updatedAt` (datetime).
- **Chaves/uniques e índices conceituais**
  - Chave primária: `id`.
  - Unique: (`idempotencyKey`, `scope`) — por API/escopo.
  - Índices:
    - Índice em `businessKey` para análise de conflitos de negócio.
    - Índice em `expiresAt` para limpeza (TTL/GC).
- **Relacionamentos**
  - Opcional N:1 com `Payment` (via `resourceId` e `scope`).
  - Pode referenciar `Transaction` em escopos operacionais (ex.: captura, refund).

### 1.4. `ProviderConfig` (Configuração de Provedor)

- **Descrição**: Representa a configuração de como o hub fala com cada provedor.
- **Campos essenciais**
  - `id` (UUID).
  - `providerId` (string).
  - `merchantId` (string).
  - `credentials` (JSON): chaves/tokens (nunca expostos em responses).
  - `routingRules` (JSON): regras de roteamento/prioridade.
  - `createdAt`, `updatedAt`.
- **Chaves/uniques e índices conceituais**
  - Unique: (`providerId`, `merchantId`).
  - Índice em `providerId`.

### 1.5. `EventLog` (Evento de Domínio / Audit Log)

- **Descrição**: Registro de eventos de domínio e de integração (para auditoria, replays assíncronos e debugging).
- **Campos essenciais**
  - `id` (UUID).
  - `aggregateType` (string): ex.: `Payment`, `Transaction`.
  - `aggregateId` (string): ex.: `paymentId`, `transactionId`.
  - `eventType` (string): ex.: `PAYMENT_CREATED`, `PAYMENT_CAPTURED`, `TRANSACTION_FAILED`.
  - `payload` (JSON): dados do evento.
  - `occurredAt` (datetime).
- **Chaves/uniques e índices conceituais**
  - Índice composto em (`aggregateType`, `aggregateId`, `occurredAt`).
  - Índice em `eventType`.

---

## 2. State machine de pagamento/transação

### 2.1. State machine conceitual de `Payment`

- **Estados**
  - `INITIATED`: requisição recebida, validações básicas ok, mas ainda sem comunicação com provedor.
  - `PENDING`: enviado ao provedor, aguardando confirmação síncrona ou assíncrona.
  - `AUTHORIZED`: valor reservado pelo provedor, ainda não capturado.
  - `CAPTURED`: valor efetivamente capturado (pagamento concluído com sucesso).
  - `PARTIALLY_CAPTURED`: parte do valor foi capturada (uso em split/parciais).
  - `CANCELLED`: pagamento cancelado antes da captura (void).
  - `FAILED`: falha irrecuperável (ex.: recusa definitiva).
  - `EXPIRED`: pagamento expirado por timeout de negócio (ex.: fatura vencida, QR code expirado).
- **Transições e eventos**
  - `INITIATED` → `PENDING`
    - Evento: `create_payment` (requisição inicial validada).
  - `PENDING` → `AUTHORIZED`
    - Evento: `provider_authorized` (resposta do provedor ou webhook indicando autorização).
  - `PENDING` → `CAPTURED`
    - Evento: `provider_captured` (fluxos de venda direta / `SALE`).
  - `AUTHORIZED` → `CAPTURED`
    - Evento: `capture_requested` + `provider_captured` (captura posterior).
  - `AUTHORIZED` → `CANCELLED`
    - Evento: `void_requested` + `provider_voided`.
  - `PENDING` → `FAILED`
    - Evento: `provider_failed` ou `provider_rejected`.
  - `PENDING` → `EXPIRED`
    - Evento: `payment_timeout` (limite de tempo para resposta/ação).
  - `INITIATED` → `FAILED`
    - Evento: `validation_failed` (regras de negócio ou campos inválidos).
  - `CAPTURED` → (sem transição de estado principal; operações de `REFUND` não reabrem o pagamento, mas geram transações associadas e, opcionalmente, estados complementares como `REFUNDED` ou `PARTIALLY_REFUNDED` se o domínio exigir).
- **Eventos externos relevantes**
  - `webhook_received` (com payload do provedor).
  - `manual_action` (operações manuais via backoffice, ex.: cancelar, reprocessar).

### 2.2. State machine conceitual de `Transaction`

- **Estados**
  - `PENDING`: transação criada internamente, ainda não enviada ao provedor.
  - `PROCESSING`: requisição enviada, aguardando resposta síncrona ou assíncrona.
  - `SUCCEEDED`: operação concluída com sucesso.
  - `FAILED`: falha definitiva (interna ou do provedor).
  - `TIMED_OUT`: não houve resposta no tempo esperado (nível técnico).
  - `CANCELLED`: interrompida internamente (ex.: rollback de fluxo).
- **Transições e eventos**
  - `PENDING` → `PROCESSING`
    - Evento: `provider_request_sent`.
  - `PROCESSING` → `SUCCEEDED`
    - Evento: `provider_response_success` ou `webhook_success`.
  - `PROCESSING` → `FAILED`
    - Evento: `provider_response_error` ou `webhook_error`.
  - `PROCESSING` → `TIMED_OUT`
    - Evento: `technical_timeout`.
  - `PENDING` → `CANCELLED`
    - Evento: `cancel_before_send` (erro interno, cancelamento de fluxo).
  - `TIMED_OUT` → `SUCCEEDED`
    - Evento: `late_webhook_success` (atualização tardia via callback).
  - `TIMED_OUT` → `FAILED`
    - Evento: `late_webhook_error`.
- **Relação com `Payment`**
  - A cada mudança relevante de `Transaction` (sobretudo `SUCCEEDED`/`FAILED`), o state machine de `Payment` é avaliado para:
    - Atualizar o `status` agregado do pagamento.
    - Emitir eventos de domínio apropriados (`PAYMENT_CAPTURED`, `PAYMENT_FAILED`, etc.).

---

## 3. Idempotência

### 3.1. Chave técnica (`Idempotency-Key`) e TTL

- **Chave técnica**
  - O Payment Hub API aceita uma chave técnica `Idempotency-Key` via cabeçalho HTTP em operações sensíveis à duplicidade (ex.: criação de pagamento, captura, refund).
  - A chave é considerada no contexto de um **escopo** (`scope`), que representa a operação (ex.: `CREATE_PAYMENT`, `CAPTURE_PAYMENT`), evitando colisão entre operações diferentes com a mesma key.
- **TTL (Time To Live)**
  - Cada `IdempotencyRecord` possui um `expiresAt`, definido com base em uma política configurável (por exemplo, 24 horas a partir da primeira requisição).
  - Após o TTL:
    - A resposta armazenada deixa de ser considerada válida para replay.
    - Novas requisições com a mesma `Idempotency-Key` podem ser tratadas como novas operações (criando novo registro) ou explicitamente rejeitadas, conforme política definida (recomendado: recriar registro após expiração).

### 3.2. Chave de negócio

- **Chave(s) de negócio**
  - Além da chave técnica, o registro de idempotência pode armazenar uma **chave de negócio** (`businessKey`), como:
    - `invoiceId` (fatura),
    - combinação de `merchantId + businessReference`,
    - ou outro identificador de domínio.
- **Uso da chave de negócio**
  - Permite:
    - Detectar criação duplicada de recursos quando o cliente não envia `Idempotency-Key`, mas repete `invoiceId`.
    - Validar coerência entre `Idempotency-Key` e conteúdo semântico da requisição (previne inconsistências entre tentativas).

### 3.3. Comportamento de replay (mesma key + mesmo payload)

- **Condição de replay**
  - Ao receber uma requisição com `Idempotency-Key` já existente e:
    - `requestHash` igual ao hash da nova requisição,
    - `expiresAt` ainda no futuro,
  - O Payment Hub API:
    - **Não** executa novamente a operação de negócio.
    - **Retorna exatamente a mesma resposta** armazenada em `IdempotencyRecord` (`responseStatusCode` e `responseBody`).
- **Objetivos**
  - Garantir que reenvios causados por retries de cliente, rede ou timeouts da aplicação não resultem em:
    - Duplicidade de pagamentos/transações.
    - Divergência de estado entre cliente e hub.

### 3.4. Comportamento de conflito (mesma key + payload diferente)

- **Conflito detectado**
  - Ao receber uma requisição com `Idempotency-Key` já registrada, porém:
    - `requestHash` é diferente do armazenado,
  - O Payment Hub API:
    - **Não executa** a nova operação.
    - **Retorna um erro de conflito de idempotência** (ex.: HTTP 409) com indicação de que a chave já foi usada com outro payload.
- **Motivação**
  - Evitar que a mesma `Idempotency-Key` seja reutilizada inadvertidamente para operações semanticamente diferentes, o que poderia:
    - Introduzir ambiguidade no estado do sistema.
    - Quebrar garantias para o cliente que confia na idempotência.

### 3.5. Momento de persistir resposta para replay

- **Criação do registro**
  - O `IdempotencyRecord` é criado **no início** do processamento da requisição:
    - `status` inicial: `IN_PROGRESS`.
    - `requestHash` calculado e persistido.
- **Atualização com resposta**
  - Assim que a operação de negócio atinge um resultado terminal (do ponto de vista da API):
    - Sucesso (ex.: `Payment` criado, `Transaction` enviada e estado conhecido).
    - Falha previsível (ex.: validação, recusa do provedor).
  - O Payment Hub API:
    - Atualiza o `IdempotencyRecord` com:
      - `responseStatusCode`.
      - `responseBody` (em formato serializado).
      - `resourceId` (ex.: `paymentId`).
      - `status` = `COMPLETED` ou `FAILED`.
- **Respostas parciais vs. assíncronas**
  - Em fluxos assíncronos (ex.: pagamento via boleto/PIX com callback posterior):
    - A resposta inicial (ex.: `201 Created` com `paymentId` e dados necessários para o cliente continuar) é a que é persistida.
    - Atualizações posteriores de estado (via webhook) **não alteram** a resposta de idempotência, apenas o estado do `Payment`/`Transaction`.
- **Falhas técnicas**
  - Se ocorrer uma falha técnica após a criação do `IdempotencyRecord` mas antes de persistir uma resposta terminal:
    - O registro pode permanecer em `IN_PROGRESS`.
    - Novos reenvios com a mesma `Idempotency-Key` podem:
      - Retomar o fluxo (se seguro) ou
      - Retornar um erro apropriado indicando que a operação está em processamento/indeterminada, dependendo da política do domínio.
