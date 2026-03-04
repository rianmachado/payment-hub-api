## C4 — Nível 1: Contexto do Sistema

### 1. Escopo

**Sistema em foco**: `Payment Hub API` — uma API REST em NestJS para orquestrar pagamentos de diferentes provedores (PSPs), oferecendo interface consistente para:
- **Criar pagamento**.
- **Consultar pagamento**.
- **Aplicar idempotência** sobre a criação de pagamentos.

### 2. Pessoas (Actors)

- **Cliente da API (Person)**
  - Sistemas externos (e-commerces, apps, serviços internos) que consomem a `Payment Hub API`.
  - Responsável por:
    - Enviar requisições HTTP para criar e consultar pagamentos.
    - Gerar e reutilizar `Idempotency-Key`.
    - Propagar (ou consumir) `X-Correlation-Id` para rastreabilidade ponta a ponta.

### 3. Sistemas / Contexto

- **Payment Hub API (Software System) — sistema em foco**
  - Implementado em NestJS.
  - Expõe endpoints REST para criação e consulta de pagamentos.
  - Centraliza lógica de:
    - Validação de payloads.
    - Idempotência.
    - Orquestração de chamadas a provedores (PSPs).
    - Persistência de dados de `payment` e `transaction`.
    - Padronização de erros e propagação de `correlation-id`.

- **PSP / Provider (External Software System)**
  - Sistema externo (real ou simulado) responsável por processar a transação financeira.
  - Recebe requisições da `Payment Hub API` e responde com:
    - Aprovado.
    - Recusado.
    - Pendente.
    - Erro técnico.

- **Banco de Dados de Pagamentos (Database System)**
  - Armazena entidades de `payment`, `transaction` e metadados de idempotência.
  - Pode ser Postgres, SQLite ou outro banco relacional.

- **Infra de Observabilidade / Logging (External System, opcional)**
  - Stack de logs/monitoramento (ex.: stdout + agregador).
  - Consome logs estruturados com `X-Correlation-Id`.

### 4. Relações (Contexto)

- **Cliente da API → Payment Hub API**
  - `HTTP POST /payments` com:
    - `Idempotency-Key`.
    - `X-Correlation-Id`.
    - Dados de valor, método de pagamento, `businessKey` etc.
  - `HTTP GET /payments/{paymentId}` ou por `businessKey` para consulta de estado.

- **Payment Hub API → Banco de Dados de Pagamentos**
  - Persiste:
    - Entidades de `payment` (incluindo `Idempotency-Key`, `businessKey`, `correlationId`, status).
    - Entidades de `transaction` (tentativas com provedores).
  - Lê:
    - Pagamentos e transações para:
      - Verificação de idempotência.
      - Consulta de estado.

- **Payment Hub API → PSP / Provider**
  - Envia requisições para criar/autorizAR/atualizar transações de pagamento.
  - Recebe respostas com status financeiro e códigos de erro.
  - Propaga `correlation-id` quando possível.

- **Payment Hub API → Infra de Observabilidade / Logging**
  - Emite logs estruturados por requisição, sempre incluindo:
    - `correlationId`.
    - Informações de rota, status code, tempo de resposta.
    - Eventos de integração com PSPs.

### 5. Boundaries (Fronteiras de Contexto)

- **Fronteira externa (Cliente da API)**
  - Fora do controle da `Payment Hub API`.
  - Define:
    - Contratos de integração (headers obrigatórios, formato de payload).
    - Política de geração e reuso de `Idempotency-Key`.

- **Fronteira da Payment Hub API**
  - Onde aplicamos decisões de arquitetura (NestJS, módulos, camadas).
  - Responsabilidades principais:
    - Prover API REST estável.
    - Aplicar regras de negócio de pagamento.
    - Garantir idempotência de criação de pagamentos.
    - Esconder detalhes de provedores (PSPs) por trás de abstrações internas.

- **Fronteira de provedores (PSP)**
  - Sistemas totalmente externos.
  - Interação realizada por meio de:
    - Adaptadores/clients HTTP internos à `Payment Hub API`.
    - Contratos internos que normalizam respostas e erros.

- **Fronteira de persistência**
  - Banco de dados tratado como dependência infra:
    - Acesso encapsulado por repositórios/ORM.
    - Nenhum cliente externo interage diretamente com o banco.

### 6. Visão resumida de responsabilidades

- **Cliente da API**
  - Orquestra o negócio final (ex.: fluxo de compra).
  - Gera `Idempotency-Key`.
  - Envia e consome `X-Correlation-Id`.

- **Payment Hub API**
  - É o **hub central** de orquestração de pagamentos.
  - Concentra:
    - Validação.
    - Idempotência.
    - Persistência.
    - Integração com PSPs.
    - Padrão de erros.

- **PSP / Provider**
  - Responsável apenas pelo processamento financeiro.
  - Não “conhece” `businessKey` ou detalhes de domínio do cliente, apenas dados necessários para a transação.

- **Banco de Dados**
  - Mantém o estado histórico e atual dos pagamentos e transações.
  - Permite reconstituir o resultado de chamadas idempotentes sem reconsultar o PSP.

---

### 7. Diagrama textual de contexto (estilo C4)

- **Pessoas**
  - `Cliente da API` (Person) — Consome a `Payment Hub API` para criar e consultar pagamentos.

- **Sistema em foco**
  - `Payment Hub API` (Software System) — Orquestra pagamentos, aplica idempotência e padroniza erros.

- **Sistemas externos**
  - `PSP / Provider` (Software System externo) — Processa a transação financeira.
  - `Banco de Dados de Pagamentos` (Database System) — Persiste pagamentos, transações e chaves de idempotência.
  - `Infra de Observabilidade / Logging` (External System) — Recebe logs com `correlationId`.

- **Relações**
  - `Cliente da API -> Payment Hub API`: envia requisições HTTP para criar/consultar pagamentos, com `Idempotency-Key` e `X-Correlation-Id`.
  - `Payment Hub API -> Banco de Dados de Pagamentos`: lê/escreve entidades de `payment` e `transaction`, além de registros de idempotência.
  - `Payment Hub API -> PSP / Provider`: chama adapters/clients para processar pagamentos; recebe status e códigos de erro.
  - `Payment Hub API -> Infra de Observabilidade / Logging`: envia logs estruturados com `correlationId` e dados da requisição/resposta.

