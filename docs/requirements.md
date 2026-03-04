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
- **Consultar pagamento**: busca por `paymentId` ou `businessKey` → retorno 200 ou erro 404 padronizado.
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

_(a preencher)_

## Requisitos não funcionais

_(a preencher)_
