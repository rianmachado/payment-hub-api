# 100% com IA. Payment Hub API (simplificado) — Baseline

## 1. Objetivo do projeto e escopo

### Objetivo geral

Centralizar e padronizar a orquestração de pagamentos de diferentes provedores (PSPs) por meio de uma API REST em NestJS, oferecendo uma interface consistente para criação e consulta de pagamentos, com foco em idempotência, rastreabilidade (correlation-id) e padronização de erros.

### Escopo IN (o que entra)

- **API REST** para:
  - **Criar pagamento** (solicitação de pagamento para um PSP/provedor).
  - **Consultar pagamento** (estado atual e metadados do pagamento).
- **Modelo simplificado de domínio**:
  - Entidade conceitual de **payment** (pagamento).
  - Entidade conceitual de **transaction** (transação por provedor).
- **Integração abstrata com PSPs**:
  - Simulação ou contrato genérico para comunicação com provedores (sem necessidade de integração real neste momento).
- **Idempotência**:
  - Garantia de que múltiplos requests com mesma `Idempotency-Key` resultem na mesma resposta lógica.
- **Observabilidade básica**:
  - Uso de `X-Correlation-Id` para rastreamento ponta a ponta.
- **Padrão de erro comum**:
  - Estrutura uniforme de retorno de erros com `code`, `message`, `details?`, `correlationId`.
- **Infra de persistência simplificada**:
  - Uso de TypeORM (ou equivalente) para persistir pagamentos e transações, ainda que em banco local (ex.: Postgres ou SQLite em dev).

### Escopo OUT (o que NÃO entra neste baseline)

- **Gestão de usuários, perfis ou contas** (sem autenticação de usuário final neste estágio, apenas visão técnica de Auth JWT futura).
- **Console de backoffice / UI web** para operação humana.
- **Workflow complexo de reconciliação financeira** (conciliation, chargeback, estornos avançados, disputa).
- **Integração real com múltiplos PSPs específicos** (ex.: PagSeguro, Stripe, etc.) — fica apenas como abstração.
- **Gestão de múltiplas moedas ou câmbio** (apenas modelo simples de valor + currency).
- **Motor de regras complexas de roteamento de pagamento** (apenas roteamento básico/simplificado).
- **Monitoramento avançado (APM, dashboards)** — apenas base conceitual via correlation-id e logs.
- **Segurança avançada** (rate limiting distribuído, WAF, etc.) além do básico conceitual de status 429 e Auth JWT futura.

---

## 2. Fluxos (somente descrição, sem implementação)

### 2.1. Fluxo: Criar pagamento

- **Atores e fronteiras**
  - **Cliente da API**: sistema que consome a Payment Hub API (ex.: e-commerce).
  - **Payment Hub API**: camada NestJS que recebe, valida, orquestra e persiste dados.
  - **Provider/PSP**: provedor externo (real ou simulado) que processa o pagamento.

- **Entrada (requisição HTTP)**
  - Método: **POST** `/payments` (rota ilustrativa).
  - Headers obrigatórios:
    - `Authorization`: token de autenticação (ex.: Bearer JWT).
    - `Idempotency-Key`: chave única por intenção de pagamento.
    - `X-Correlation-Id`: identificador de correlação do fluxo de negócio.
  - Corpo contendo, em alto nível:
    - `amount` (valor).
    - `currency`.
    - `paymentMethod` (ex.: card, pix, boleto — simplificado).
    - `businessKey` (ex.: referência do pedido no sistema cliente).
    - Dados mínimos necessários ao provedor (dependendo do tipo de pagamento).

- **Etapas do fluxo (conceituais)**
  - **1. Recepção e validação**
    - API recebe a requisição com `Idempotency-Key` e `X-Correlation-Id`.
    - Valida o payload (DTOs + validation pipes): campos obrigatórios, formatos, ranges.
    - Se inválido, retorna erro 400 com o padrão de erro definido.
  - **2. Verificação de idempotência**
    - Busca em armazenamento local um registro de pagamento associado à `Idempotency-Key`.
    - Se já existir um pagamento:
      - Retorna o estado atual daquele pagamento, sem criar uma nova transação.
  - **3. Criação do pagamento (primeira vez)**
    - Cria registro de **payment** com estado inicial (ex.: `PENDING`), associando:
      - `businessKey`.
      - `Idempotency-Key`.
      - `correlationId`.
    - Cria registro de **transaction** representando a tentativa de processamento no provider.
  - **4. Chamada ao provider/PSP**
    - A API orquestra chamada ao provedor, passando dados necessários (via client abstrato).
    - Recebe resposta do PSP (aprovado, recusado, pendente, erro técnico, etc.).
  - **5. Atualização de estados**
    - Atualiza `transaction` com o resultado retornado.
    - Atualiza `payment` com o estado derivado (ex.: `AUTHORIZED`, `DECLINED`, `FAILED`, `PENDING`).
  - **6. Resposta ao cliente**
    - Retorna um recurso de **payment** enriquecido:
      - Estado atual.
      - Metadados principais da transação.
      - `businessKey`.
      - `correlationId` (mesmo do request ou gerado e propagado).
    - Utiliza status code adequado (ex.: 201 para criação bem-sucedida).

### 2.2. Fluxo: Consultar pagamento

- **Atores e fronteiros**
  - **Cliente da API**: sistema que precisa conhecer o estado de um pagamento.
  - **Payment Hub API**: camadas de controller, service e repositório.

- **Entrada (requisição HTTP)**
  - Método: **GET** `/payments/{paymentId}` ou `/payments/by-idempotency-key/{idempotencyKey}` (ver OpenAPI).
  - Headers recomendados:
    - `Authorization`: token de autenticação.
    - `X-Correlation-Id`: identificador/propagado para rastreio do request.

- **Etapas do fluxo (conceituais)**
  - **1. Recepção e validação de rota/parâmetros**
    - API valida `paymentId` ou `businessKey` (formato, tipo, etc.).
  - **2. Consulta no repositório**
    - Busca o registro de **payment** e, opcionalmente, a última **transaction** relevante.
  - **3. Mapeamento para resposta externa**
    - Mapeia o modelo de domínio interno para uma resposta de API contendo:
      - Identificadores (`paymentId`, `businessKey`).
      - Estado atual do pagamento.
      - Informações de valor, currency e método.
      - Metadados relevantes sobre a última transação.
      - `correlationId`.
  - **4. Resposta ao cliente**
    - Se encontrado:
      - Retorna a representação do pagamento (status 200).
    - Se não encontrado:
      - Retorna erro 404 no padrão de erro definido.

### 2.3. Fluxo: Idempotência de pagamento

- **Objetivo da idempotência**
  Garantir que múltiplas requisições de criação de pagamento com a mesma intenção de negócio (mesmo `businessKey` e mesma `Idempotency-Key`) não gerem múltiplos pagamentos distintos ou duplicados no PSP.

- **Princípios gerais**
  - **Chave de idempotência**:
    - A `Idempotency-Key` é fornecida pelo cliente da API.
    - A combinação de `Idempotency-Key` + `businessKey` deve ser tratada como única para uma **intenção de pagamento**.
  - **Persistência do resultado**:
    - O resultado da primeira requisição bem-sucedida (ou com falha conhecida) é armazenado e reutilizado.
  - **Determinismo da resposta**:
    - Requisições subsequentes com mesma `Idempotency-Key` retornam a mesma visão lógica de **payment**, sem re-chamar o PSP.

- **Etapas conceituais de idempotência**
  - **1. Receber requisição com `Idempotency-Key`**
    - Se o header não vier, a API pode:
      - Rejeitar a requisição (400) ou
      - Tratar como "não idempotente" (decisão de design a ser tomada).
  - **2. Checar existência de registro vinculado à chave**
    - Se já existe um `payment` vinculado àquela `Idempotency-Key`:
      - Retornar a representação do pagamento existente.
  - **3. Criar registro e travar chave**
    - Criar um registro de `payment` atrelado à `Idempotency-Key`.
    - Opção de bloqueio transacional ou marcação de chave para evitar corrida (race condition).
  - **4. Executar lógica de negócio**
    - Chamar o PSP apenas na primeira vez.
    - Persistir o resultado.
  - **5. Reutilizar resultado para chamadas subsequentes**
    - Para requisições repetidas:
      - Nunca re-enfileirar ou re-chamar o PSP.
      - Retornar o mesmo conteúdo (ou estado mais recente) do pagamento atrelado àquela chave.

---

## 3. Glossário mínimo

| Termo | Definição |
|-------|-----------|
| **Payment (pagamento)** | Representa a intenção de pagamento de um valor para uma determinada finalidade de negócio (ex.: pedido de compra), incluindo estado de processamento, valor, moeda, método de pagamento, `businessKey` e vínculo a uma ou mais `transactions` realizadas com provedores. |
| **Transaction (transação)** | Representa uma tentativa individual de processamento de um pagamento junto a um **provider/PSP** específico. Cada payment pode ter uma ou mais transactions, refletindo tentativas de autorização, captura, cancelamento etc. |
| **Provider / PSP (Payment Service Provider)** | Entidade externa responsável pelo processamento financeiro do pagamento (ex.: gateways, adquirentes, intermediadores). No contexto deste projeto, será tratado como uma abstração (contrato) que recebe solicitações da Payment Hub API e responde com estados de aprovação, recusa ou erro. |
| **Idempotency-Key** | Chave única (string gerada pelo cliente da API) que identifica uma intenção de pagamento de forma determinística. É usada para garantir que múltiplas requisições de criação de pagamento com a mesma chave resultem no mesmo `payment` (sem duplicação). |
| **Business key (chave de negócio)** | Identificador oriundo do domínio do cliente (ex.: `orderId`, `invoiceId`) que vincula o `payment` a uma entidade de negócio externa. Auxilia correlação funcional (ex.: localizar pagamentos associados a um pedido específico). |
| **Correlation-id** | Identificador técnico para rastrear um fluxo de requisição ponta a ponta entre sistemas. É propagado em logs, integrações e respostas para facilitar debug, auditoria técnica e observabilidade. |

---

## 4. Convenções

### 4.1. Headers

- **`Idempotency-Key`**
  - Obrigatório em operações de criação de pagamento.
  - Deve ser:
    - Único por intenção de pagamento dentro de uma janela de tempo definida (a decidir).
    - Mantido pelo cliente da API (geração e reuso em novas tentativas).
  - Usado para vincular requisições repetidas ao mesmo `payment`.

- **`X-Correlation-Id`**
  - Pode ser enviado pelo cliente da API; caso ausente, a API pode gerar um novo valor.
  - Deve ser:
    - Registrado em logs.
    - Devolvido em erros e respostas bem-sucedidas, para rastreamento.
  - Propagado para chamadas a provedores/PSPs sempre que possível.

### 4.2. Padrão de erro

- **Formato base**
  - Objeto de erro padronizado:
    - `code`: identificador técnico e estável do tipo de erro (ex.: `PAYMENT_VALIDATION_ERROR`, `PAYMENT_NOT_FOUND`).
    - `message`: mensagem legível explicando o erro (pode ser adaptada ao idioma ou público-alvo).
    - `details?`: campo opcional com informações adicionais (ex.: lista de validações quebradas, campos inválidos, metadados técnicos).
    - `correlationId`: valor de `X-Correlation-Id` associado à requisição.

- **Regras gerais**
  - O `code` não deve depender de mensagens de provedores externos; deve ser uma taxonomia interna.
  - A `message` pode ocultar detalhes sensíveis; informações internas/stack traces não devem ir para o cliente.
  - O `correlationId` deve ser o mesmo recebido/gerado na entrada da requisição.

### 4.3. Status codes esperados (alto nível)

| Categoria | Código | Uso |
|-----------|--------|-----|
| **2xx** | **200 OK** | Consultar pagamento com sucesso; requisições idempotentes de criação onde o recurso já existia (replay com mesma `Idempotency-Key`). |
| | **201 Created** | Criação de pagamento bem-sucedida na primeira tentativa. |
| **4xx** | **400 Bad Request** | Erros de validação de payload, parâmetros obrigatórios ausentes, formato inválido. |
| | **401 Unauthorized** | Token ausente ou inválido (estágio posterior com Auth JWT). |
| | **403 Forbidden** | Cliente autenticado, mas sem permissão para a operação ou recurso. |
| | **404 Not Found** | Pagamento não encontrado para o identificador fornecido. |
| | **409 Conflict** | Conflitos de negócio (ex.: tentativa de criar pagamento com `Idempotency-Key` conflitante em estado inconsistente). |
| | **422 Unprocessable Entity** | Regras de negócio violadas (ex.: método de pagamento não suportado para determinado contexto). |
| | **429 Too Many Requests** | Rate limiting aplicado à API (conceitual neste baseline). |
| **5xx** | **500 Internal Server Error** | Erro inesperado no servidor (ex.: falhas desconhecidas, exceções não tratadas). |
| | **502 Bad Gateway / 503 Service Unavailable** | Problemas na comunicação com provedores externos (PSPs) ou indisponibilidade temporária (opcionais, conceituais). |

---

## 5. Ordem de fixação NestJS (trilho de aprendizado e construção)

A ideia é seguir uma trilha progressiva, consolidando conceitos antes de avançar:

1. **Modules** — Definir a organização modular do projeto (`PaymentModule`, `ProviderModule`, etc.); entender como NestJS agrupa responsabilidades por domínio.

2. **DTO / Validation / Pipes / Middlewares** — Criar DTOs para requisições e respostas de pagamento; aplicar validações com class-validator/class-transformer; usar pipes para transformação e validação centralizada; introduzir middlewares para logging, parse de headers (`X-Correlation-Id`), etc.

3. **TypeORM (ou ORM equivalente)** — Modelar entidades de `payment` e `transaction`; configurar repositórios e migrations (mesmo que simplificadas); garantir persistência da `Idempotency-Key` e estados de pagamento.

4. **Services** — Implementar serviços de domínio: regras de criação de pagamento, regras de consulta, encapsulamento da lógica de idempotência.

5. **Controllers** — Expor endpoints REST alinhados aos fluxos definidos (criar pagamento, consultar pagamento); mapear DTOs de entrada e saída.

6. **Exception Filters** — Centralizar tratamento de erros e mapear exceções internas para o padrão `{ code, message, details?, correlationId }`; garantir consistência de status codes e formato de resposta em todo o projeto.

7. **Interceptors** — Implementar cross-cutting concerns: logging estruturado; enriquecimento de respostas com `correlationId`; medição básica de tempo de execução.

8. **Guards** — Preparar proteção de rotas; autorização e checagens prévias (mesmo que simplificadas); base para cenários futuros de multi-tenant ou roles.

9. **Auth JWT** — Adicionar autenticação baseada em JWT; integrar com guards para proteger endpoints sensíveis; definir escopos/claims mínimos necessários para operações de pagamento.

---

## 6. Checklist: "Pronto para avançar para arquitetura C4"

Antes de partir para modelagem C4 (Context, Container, Component, Code), os seguintes itens devem estar claros/documentados:

- [ ] **Domínio mínimo definido** — Conceitos de `payment`, `transaction`, `provider/psp`, `idempotency-key`, `business key` e `correlation-id` descritos e entendidos.

- [ ] **Fluxos principais mapeados** — Passo a passo de criar pagamento, consultar pagamento e idempotência de pagamento.

- [ ] **Contratos de API em alto nível** — Rotas principais, métodos HTTP, headers obrigatórios (`Idempotency-Key`, `X-Correlation-Id`) e status codes esperados documentados (mesmo que ainda sem exemplo de payload detalhado).

- [ ] **Convenções técnicas definidas** — Padrão de erro `{ code, message, details?, correlationId }`; uso de correlation-id e idempotency-key padronizados; decisões iniciais sobre autenticação futura (JWT) e rate limiting.

- [ ] **Trilho de implementação em NestJS acordado** — Ordem de fixação (Modules → DTO/Validation/Pipes/Middlewares → TypeORM → Services → Controllers → Exception Filters → Interceptors → Guards → Auth JWT) aceita como plano de execução.

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
