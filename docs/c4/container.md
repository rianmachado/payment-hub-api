## C4 — Nível 2: Visão de Contêineres

### 1. Escopo

Esta visão detalha **como o sistema `Payment Hub API` é decomposto em contêineres** (aplicações e serviços executáveis) e como eles interagem entre si e com sistemas externos.

### 2. Contêineres

- **C1. Cliente da API (External Application)**
  - Qualquer sistema que consuma a `Payment Hub API` (e-commerce, back-end interno, etc.).
  - Responsabilidades:
    - Montar requisições HTTP (POST/GET) com os headers corretos (`Idempotency-Key`, `X-Correlation-Id`).
    - Interpretar as respostas (sucesso/erro) e seguir o fluxo de negócio.

- **C2. Payment Hub API (NestJS Application) — contêiner principal**
  - Aplicação NestJS que expõe a API REST e orquestra todos os fluxos de pagamento.
  - Responsabilidades:
    - Expor endpoints públicos (`/payments`, etc.).
    - Aplicar validação, autenticação/autorização (futuro), idempotência.
    - Orquestrar regras de negócio de pagamento.
    - Interagir com o banco de dados e com provedores externos.
    - Centralizar tratamento de erros e logging com `correlationId`.

- **C3. Banco de Dados de Pagamentos (Relational Database)**
  - Banco relacional (Postgres, SQLite, etc.).
  - Responsabilidades:
    - Persistir:
      - Entidades de `payment`.
      - Entidades de `transaction`.
      - Dados necessários para idempotência (`Idempotency-Key` / chaves compostas).
    - Oferecer transações e constraints para garantir consistência.

- **C4. Provedor de Pagamento / PSP (External Service)**
  - Serviço externo ou simulado que processa transações financeiras.
  - Responsabilidades:
    - Receber requisições de pagamento da `Payment Hub API`.
    - Responder com o resultado da tentativa (aprovado, recusado, pendente, erro).

- **C5. Stack de Observabilidade / Logging (External Service, opcional)**
  - Serviço de agregação de logs/monitoramento (pode ser apenas stdout em ambiente simples).
  - Responsabilidades:
    - Receber logs estruturados da `Payment Hub API`.
    - Permitir consultas e dashboards com base em `correlationId`.

### 3. Relações entre Contêineres

- **C1 → C2: Cliente da API → Payment Hub API**
  - `HTTP POST /payments` (criação).
  - `HTTP GET /payments/{id}` ou variante (consulta).
  - Headers chave:
    - `Idempotency-Key` (obrigatório na criação).
    - `X-Correlation-Id` (recomendado/obrigatório).

- **C2 ↔ C3: Payment Hub API ↔ Banco de Dados de Pagamentos**
  - **Escrita**:
    - Criação de registros de `payment` e `transaction`.
    - Atualização de estados conforme resultado do PSP.
    - Persistência de dados de idempotência.
  - **Leitura**:
    - Busca de pagamentos por `id`, `businessKey` ou `Idempotency-Key`.
    - Recuperação de transações para enriquecer respostas e implementar idempotência.

- **C2 ↔ C4: Payment Hub API ↔ Provedor de Pagamento / PSP**
  - **Saída**:
    - Chamada HTTP (ou outro protocolo) para criar/autorizAR pagamento.
    - Propagação de `correlation-id` quando possível.
  - **Entrada**:
    - Resposta com status financeiro e códigos de erro.

- **C2 → C5: Payment Hub API → Stack de Observabilidade / Logging**
  - Emissão de logs estruturados contendo:
    - Rota, método e status code.
    - Identificadores de requisição (`correlationId`, `Idempotency-Key`).
    - Dados relevantes das interações com o PSP.

### 4. Boundaries e responsabilidades por contêiner

- **Payment Hub API (C2)**
  - **Boundary de aplicação**:
    - Isola o domínio de pagamentos de detalhes de protocolos externos (HTTP externo, protocolos do PSP).
    - Exposição de uma API REST estável, ainda que integrações com PSPs mudem.
  - **Responsabilidades centrais**:
    - Garantir que a `Idempotency-Key` seja respeitada (não criação duplicada).
    - Encapsular todo o acesso ao banco (C3).
    - Encapsular toda a integração com PSPs (C4).
    - Fornecer contrato de erro consistente.

- **Banco de Dados (C3)**
  - **Boundary de infraestrutura**:
    - Não expõe interface diretamente a clientes ou PSPs.
    - É acessado apenas pela `Payment Hub API`.
  - **Responsabilidades**:
    - Integridade referencial entre `payment` e `transaction`.
    - Suporte a consultas de leitura para API (ex.: por `businessKey`).

- **PSP / Provider (C4)**
  - **Boundary externo**:
    - Fora do controle da `Payment Hub API`.
    - Encapsulado por clients/adapters internos ao contêiner C2.
  - **Responsabilidades**:
    - Processamento financeiro efetivo.
    - Definição do contrato de integração técnica (endpoints, autenticação, etc.).

### 5. Diagrama textual de contêineres (estilo C4)

- **Contêineres**
  - `C1: Cliente da API` (External Application).
  - `C2: Payment Hub API` (NestJS Application).
  - `C3: Banco de Dados de Pagamentos` (Relational Database).
  - `C4: Provedor de Pagamento / PSP` (External Service).
  - `C5: Stack de Observabilidade / Logging` (External Service, opcional).

- **Relações**
  - `C1 -> C2`: envia requisições HTTP (POST/GET) para criar e consultar pagamentos, com `Idempotency-Key` e `X-Correlation-Id`.
  - `C2 -> C3`: lê/escreve `payment` e `transaction`, além de dados de idempotência.
  - `C2 -> C4`: chama APIs do PSP para processar a transação de pagamento.
  - `C2 -> C5`: envia logs estruturados com `correlationId` e metadados da requisição.

