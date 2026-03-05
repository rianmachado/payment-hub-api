# Payment Hub API — Especificação OpenAPI (Markdown)

Especificação descritiva da API REST do Payment Hub (simplificado), alinhada a [requirements.md](../requirements.md), [components.md](../c4/components.md) e [data-state.md](../data-state.md).

---

## 1. Informações gerais

| Campo | Valor |
|-------|--------|
| **Título** | Payment Hub API |
| **Descrição** | API REST para criação e consulta de pagamentos, com idempotência e rastreabilidade via correlation-id. |
| **Base URL** | `https://api.example.com` (ou variável por ambiente) |
| **Protocolo** | HTTPS |
| **Autenticação** | Bearer (JWT/OAuth2) via header `Authorization` |

---

## 2. Headers comuns

### 2.1. Obrigatórios por operação

| Header | Obrigatório | Onde | Descrição |
|--------|-------------|------|-----------|
| `Authorization` | Sim | Todos os endpoints | Token de autenticação (ex.: `Bearer <token>`). |
| `Idempotency-Key` | Sim | `POST /payments` | Chave única por combinação de negócio em janela de tempo; evita duplicação. |
| `X-Correlation-Id` | Não (recomendado) | Todos | Identificador de rastreio ponta a ponta; se ausente, o hub gera um. |

### 2.2. Formato e limites

- **Idempotency-Key**: string, não vazia, tamanho máximo conforme política (ex.: 128 caracteres). Única por `(tenant/cliente, Idempotency-Key)` na janela configurada.
- **X-Correlation-Id**: string (ex.: UUID), opcional; retornado em respostas e no corpo de erros (`correlationId`).

---

## 3. Modelo de erro padrão

Todas as respostas de erro (4xx/5xx) seguem o mesmo schema:

```json
{
  "code": "string",
  "message": "string",
  "details": {},
  "correlationId": "string"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `code` | string | Sim | Código de erro da taxonomia interna (ex.: `PAYMENT_NOT_FOUND`, `PAYMENT_IDEMPOTENCY_CONFLICT`). |
| `message` | string | Sim | Mensagem legível para o cliente. |
| `details` | object | Não | Dados adicionais (ex.: `fieldErrors`, `paymentId`, `idempotencyKey`). |
| `correlationId` | string | Sim | Mesmo valor de `X-Correlation-Id` da requisição ou gerado pelo hub. |

---

## 4. Endpoints

### 4.1. Criar pagamento

**`POST /payments`**

Registra uma nova intenção de pagamento. Sujeito a idempotência: mesma `Idempotency-Key` + mesmo payload → mesma resposta (201/200) sem nova cobrança ao PSP.

#### Headers

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `Authorization` | Sim | Token de autenticação. |
| `Idempotency-Key` | Sim | Chave idempotente. |
| `X-Correlation-Id` | Não | Rastreio; gerado se ausente. |
| `Content-Type` | Sim | `application/json`. |

#### Request body (schema)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `payer` | object | Sim | Identificação do pagador. |
| `payer.id` | string | Condicional | ID interno do pagador (uso com `payer.externalId` conforme política). |
| `payer.externalId` | string | Condicional | ID externo do pagador. Obrigatório `payer.id` **ou** `payer.externalId`. |
| `payee` | object | Sim | Identificação do favorecido. |
| `payee.id` | string | Condicional | ID interno do favorecido. |
| `payee.externalId` | string | Condicional | ID externo do favorecido. Obrigatório `payee.id` **ou** `payee.externalId`. |
| `amount` | number (decimal) | Sim | Valor do pagamento; deve ser > 0. |
| `currency` | string | Sim | Moeda ISO 4217 (ex.: `BRL`, `USD`). |
| `paymentMethod` | object | Sim | Meio de pagamento. |
| `paymentMethod.type` | string | Sim | Tipo: ex. `PIX`, `CARD`, `BOLETO`. |
| `paymentMethod.*` | * | Condicional | Campos específicos por tipo (ex.: chave PIX, token de cartão). |
| `externalReference` | string | Não | Referência do sistema chamador. |
| `callbackUrl` | string (URI) | Não | URL para notificação assíncrona. |
| `metadata` | object | Não | Mapa chave/valor. |

#### Response — Sucesso (primeira criação)

**Status:** `201 Created`

**Body (schema):**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `paymentId` | string (UUID) | Identificador único do pagamento. |
| `status` | string | Estado atual: `CREATED`, `PENDING`, `FAILED`, etc. |
| `amount` | number | Valor. |
| `currency` | string | Moeda. |
| `payer` | object | Pagador (normalizado). |
| `payee` | object | Favorecido (normalizado). |
| `paymentMethod` | object | Meio de pagamento (mascarado/seguro). |
| `externalReference` | string \| null | Referência externa. |
| `createdAt` | string (date-time) | Data/hora de criação. |
| `updatedAt` | string (date-time) | Data/hora de última atualização. |
| `idempotencyKey` | string | Chave idempotente utilizada. |
| `correlationId` | string | Identificador de correlação. |
| `idempotencyReplay` | boolean | Opcional; `true` quando a resposta é de replay. |

#### Response — Sucesso (replay compatível)

**Status:** `200 OK` ou `201 Created` (conforme convenção)

Mesmo body do sucesso acima; pode incluir `idempotencyReplay: true`. Nenhuma nova chamada ao PSP.

#### Response — Erros

| Status | Cenário | `code` (exemplo) |
|--------|---------|-------------------|
| `400 Bad Request` | Payload inválido, `Idempotency-Key` ausente/inválida | `IDEMPOTENCY_KEY_REQUIRED`, `PAYMENT_VALIDATION_ERROR` |
| `401 Unauthorized` | Token inválido ou ausente | (código de auth) |
| `403 Forbidden` | Sem permissão para criar pagamentos | (código de auth) |
| `409 Conflict` | Mesma idempotency key com payload diferente | `PAYMENT_IDEMPOTENCY_CONFLICT` |
| `422 Unprocessable Entity` | Regra de negócio rejeitou (limite, bloqueio, etc.) | `PAYMENT_BUSINESS_RULE_VIOLATION` |
| `429 Too Many Requests` | Rate limit excedido | (código de rate limit) |
| `500 Internal Server Error` | Erro inesperado | (código interno) |
| `503 Service Unavailable` | Dependência crítica indisponível | (código interno) |

#### Exemplo — Request (criar pagamento)

```http
POST /payments HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Idempotency-Key: ord-12345-inv-67890
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "payer": { "externalId": "cust-001" },
  "payee": { "externalId": "merchant-002" },
  "amount": 150.50,
  "currency": "BRL",
  "paymentMethod": { "type": "PIX", "pixKey": "merchant@example.com" },
  "externalReference": "invoice-2024-001",
  "metadata": { "channel": "web" }
}
```

#### Exemplo — Response 201 (sucesso)

```json
{
  "paymentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PENDING",
  "amount": 150.50,
  "currency": "BRL",
  "payer": { "externalId": "cust-001" },
  "payee": { "externalId": "merchant-002" },
  "paymentMethod": { "type": "PIX", "masked": "***@example.com" },
  "externalReference": "invoice-2024-001",
  "createdAt": "2024-03-04T10:00:00.000Z",
  "updatedAt": "2024-03-04T10:00:00.000Z",
  "idempotencyKey": "ord-12345-inv-67890",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Exemplo — Response 409 (conflito de idempotência)

```json
{
  "code": "PAYMENT_IDEMPOTENCY_CONFLICT",
  "message": "Conflito de idempotência: requisição incompatível com chamada anterior.",
  "details": {
    "idempotencyKey": "ord-12345-inv-67890",
    "existingPaymentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Exemplo — Response 422 (validação/regra de negócio)

```json
{
  "code": "PAYMENT_VALIDATION_ERROR",
  "message": "Dados de pagamento inválidos.",
  "details": {
    "fieldErrors": [
      { "field": "amount", "error": "MUST_BE_POSITIVE" }
    ]
  },
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 4.2. Consultar pagamento por ID

**`GET /payments/{paymentId}`**

Recupera o estado atual e dados principais de um pagamento. O cliente deve ter acesso ao recurso (multi-tenant/escopo).

#### Headers

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `Authorization` | Sim | Token de autenticação. |
| `X-Correlation-Id` | Não | Rastreio. |

#### Path parameters

| Nome | Tipo | Descrição |
|------|------|-----------|
| `paymentId` | string (UUID) | Identificador do pagamento. |

#### Query parameters

| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `expand` | string | Não | Lista separada por vírgula para detalhes adicionais (ex.: `events`, `history`), conforme evolução. |

#### Response — Sucesso

**Status:** `200 OK`

**Body (schema):**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `paymentId` | string (UUID) | Identificador do pagamento. |
| `status` | string | Estado: `CREATED`, `PENDING`, `AUTHORIZED`, `SETTLED`, `FAILED`, `CANCELLED`. |
| `amount` | number | Valor. |
| `currency` | string | Moeda. |
| `payer` | object | Pagador. |
| `payee` | object | Favorecido. |
| `paymentMethod` | object | Meio de pagamento (mascarado). |
| `externalReference` | string \| null | Referência externa. |
| `createdAt` | string (date-time) | Data/hora de criação. |
| `updatedAt` | string (date-time) | Última atualização. |
| `completedAt` | string (date-time) \| null | Preenchido quando houver estado final. |
| `correlationId` | string | Correlação (última ou da criação). |

#### Response — Erros

| Status | Cenário | `code` (exemplo) |
|--------|---------|-------------------|
| `400 Bad Request` | `paymentId` em formato inválido | `PAYMENT_VALIDATION_ERROR` |
| `401 Unauthorized` | Token inválido ou ausente | (código de auth) |
| `403 Forbidden` | Cliente sem acesso ao pagamento | `PAYMENT_ACCESS_DENIED` |
| `404 Not Found` | Pagamento não encontrado | `PAYMENT_NOT_FOUND` |
| `429 Too Many Requests` | Rate limit | (código de rate limit) |
| `500 Internal Server Error` | Erro inesperado | (código interno) |

#### Exemplo — Request

```http
GET /payments/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Correlation-Id: 660e8400-e29b-41d4-a716-446655440001
```

#### Exemplo — Response 200

```json
{
  "paymentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "SETTLED",
  "amount": 150.50,
  "currency": "BRL",
  "payer": { "externalId": "cust-001" },
  "payee": { "externalId": "merchant-002" },
  "paymentMethod": { "type": "PIX", "masked": "***@example.com" },
  "externalReference": "invoice-2024-001",
  "createdAt": "2024-03-04T10:00:00.000Z",
  "updatedAt": "2024-03-04T10:01:30.000Z",
  "completedAt": "2024-03-04T10:01:30.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Exemplo — Response 404

```json
{
  "code": "PAYMENT_NOT_FOUND",
  "message": "Pagamento não encontrado.",
  "details": { "paymentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
  "correlationId": "660e8400-e29b-41d4-a716-446655440001"
}
```

---

### 4.3. Consultar pagamento por chave de idempotência

**`GET /payments/by-idempotency-key/{idempotencyKey}`**

Recupera o pagamento previamente criado associado à chave de idempotência. Útil para confirmar resultado após retry ou para obter o `paymentId` quando o cliente só dispõe da `Idempotency-Key`. Escopo: mesmo tenant/cliente da criação.

#### Headers

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `Authorization` | Sim | Token de autenticação. |
| `X-Correlation-Id` | Não | Rastreio. |

#### Path parameters

| Nome | Tipo | Descrição |
|------|------|-----------|
| `idempotencyKey` | string | Valor do header `Idempotency-Key` usado na criação. |

#### Response — Sucesso

**Status:** `200 OK`

Mesmo body do `GET /payments/{paymentId}` (representação do recurso `Payment`).

#### Response — Erros

| Status | Cenário | `code` (exemplo) |
|--------|---------|-------------------|
| `400 Bad Request` | Chave vazia ou formato inválido | `PAYMENT_VALIDATION_ERROR` |
| `401 Unauthorized` | Token inválido ou ausente | (código de auth) |
| `403 Forbidden` | Cliente sem acesso ao recurso | `PAYMENT_ACCESS_DENIED` |
| `404 Not Found` | Nenhum pagamento associado à chave (ou expirado) | `PAYMENT_NOT_FOUND` ou `IDEMPOTENCY_KEY_NOT_FOUND` |
| `429 Too Many Requests` | Rate limit | (código de rate limit) |
| `500 Internal Server Error` | Erro inesperado | (código interno) |

#### Exemplo — Request

```http
GET /payments/by-idempotency-key/ord-12345-inv-67890 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Correlation-Id: 770e8400-e29b-41d4-a716-446655440002
```

#### Exemplo — Response 200

Corpo idêntico ao do `GET /payments/{paymentId}` (exemplo acima).

#### Exemplo — Response 404 (chave sem pagamento)

```json
{
  "code": "PAYMENT_NOT_FOUND",
  "message": "Nenhum pagamento encontrado para a chave de idempotência informada.",
  "details": { "idempotencyKey": "ord-12345-inv-67890" },
  "correlationId": "770e8400-e29b-41d4-a716-446655440002"
}
```

---

## 5. Códigos de status por cenário (resumo)

| Cenário | POST /payments | GET /payments/{paymentId} | GET /payments/by-idempotency-key/{key} |
|---------|----------------|---------------------------|----------------------------------------|
| Sucesso (criação) | 201 | — | — |
| Sucesso (replay idempotente) | 200 (ou 201) | — | — |
| Sucesso (consulta) | — | 200 | 200 |
| Payload/parâmetro inválido | 400 | 400 | 400 |
| Não autenticado | 401 | 401 | 401 |
| Sem permissão | 403 | 403 | 403 |
| Recurso não encontrado | — | 404 | 404 |
| Conflito idempotência | 409 | — | — |
| Regra de negócio | 422 | — | — |
| Rate limit | 429 | 429 | 429 |
| Erro interno | 500 | 500 | 500 |
| Serviço indisponível | 503 | — | — |

---

## 6. Taxonomia de códigos de erro (referência)

| code | Uso típico |
|------|------------|
| `PAYMENT_VALIDATION_ERROR` | Campos obrigatórios ausentes, formato inválido, amount ≤ 0, etc. |
| `IDEMPOTENCY_KEY_REQUIRED` | `Idempotency-Key` ausente ou vazia em `POST /payments`. |
| `PAYMENT_IDEMPOTENCY_CONFLICT` | Mesma `Idempotency-Key` com payload diferente. |
| `PAYMENT_BUSINESS_RULE_VIOLATION` | Limite excedido, cliente bloqueado, pagador = favorecido quando proibido, etc. |
| `PAYMENT_NOT_FOUND` | Pagamento não existe ou não acessível para o cliente. |
| `PAYMENT_ACCESS_DENIED` | Cliente autenticado sem permissão para o recurso. |
| `IDEMPOTENCY_KEY_NOT_FOUND` | (Opcional) Nenhum registro para a chave em `GET by-idempotency-key`. |

---

## 7. Estados de pagamento (API)

Valores possíveis de `status` expostos na API, alinhados ao fluxo de criação e consulta:

- **CREATED** — Intenção registrada, ainda não enviada ao provedor.
- **PENDING** — Em processamento junto ao provedor.
- **AUTHORIZED** — Valor autorizado, ainda não liquidado.
- **SETTLED** — Pagamento concluído com sucesso.
- **FAILED** — Falha irrecuperável.
- **CANCELLED** — Cancelado após criação.

*(O modelo interno em [data-state.md](../data-state.md) pode usar nomes adicionais como `INITIATED`, `CAPTURED`, `EXPIRED`; o mapeamento para esses valores de API fica a cargo da implementação.)*
