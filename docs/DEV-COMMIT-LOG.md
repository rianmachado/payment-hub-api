# DEV COMMIT LOG — Harmonização documental (Documentation Harmonizer)

Ordem recomendada de commits (Conventional Commits) após as alterações de harmonização aplicadas. Executar na ordem listada.

---

1. **docs(data-state): harmonize internal and external payment states**
   - Adicionada seção 0 com vocabulário API (`payer`/`payee`) vs modelo interno (`customerId`/`merchantId`).
   - Mapeamento definitivo estados internos ↔ API (CREATED↔INITIATED, SETTLED↔CAPTURED, etc.).
   - Escopo de idempotência: MVP = cliente autenticado; evolução multi-tenant opcional; campo tenantId/clientScope documentado.

2. **docs(requirements): clarify initial payment state mapping and idempotency scope**
   - Estado inicial na criação: referência ao mapeamento em data-state; normalização payer/payee → customerId/merchantId.
   - Idempotência: escopo = cliente autenticado (evolução multi-tenant); busca por (escopo, Idempotency-Key).
   - Consulta: referência a GET by-idempotency-key; saídas com vocabulário da API e equivalência payer/payee.
   - Transição de estado: vocabulário da API com equivalências internas (CREATED↔INITIATED, SETTLED↔CAPTURED).

3. **docs(api): document payer/payee normalization and idempotency scope**
   - Nota no request body: payer/payee = contrato HTTP; interno = customerId/merchantId.
   - Idempotency-Key: escopo = cliente autenticado; evolução multi-tenant.
   - GET by-idempotency-key: escopo = mesmo cliente autenticado.
   - §7: tabela de mapeamento estados API ↔ interno.

4. **docs(roadmap): move idempotency-key lookup endpoint to phase A**
   - GET /payments/by-idempotency-key/{idempotencyKey} consolidado na Fase A.
   - Fase B: apenas idempotência avançada (comparação canônica, retenção/expiração, replay avançado).
   - Escopo da chave: cliente autenticado (evolução multi-tenant).

5. **docs(review): split open and resolved integration findings**
   - INTEGRATION-REVIEW.md reestruturado: §1.1 Pendências abertas, §1.2 Pendências resolvidas.
   - Remoção de itens já refletidos nos docs (payer/payee, estados, endpoint by-idempotency-key, roadmap, escopo idempotência, ConfigModule, HealthModule, 201/200, moedas).
   - Documento como revisão viva e confiável do estado atual.

6. **docs(c4): align terminology with harmonized domain language**
   - context.md: escopo do cliente autenticado (idempotência); payer/payee = vocabulário API, normalizados para customerId/merchantId.
   - container.md: Payment com customerId/merchantId (expostos como payer/payee); escopo do cliente; idempotência por escopo do cliente autenticado.
   - components.md: IdempotencyService com escopo do cliente autenticado; persistência com escopo do cliente; DTO com vocabulário da API; estados mapeados conforme data-state.

---

*Gerado pelo agente Documentation Harmonizer. Não implementa código; apenas documentação.*
