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

## Harmonização final (Documentation Final Harmonizer)

7. **docs(api): add v1 version prefix to endpoints**
   - Base URL e todos os endpoints com prefixo `/v1`: POST/GET /v1/payments, GET /v1/payments/by-idempotency-key/{idempotencyKey}, GET /v1/health.
   - Exemplos de request e tabelas de status/códigos de erro atualizados.

8. **docs(quality): standardize idempotency scope to authenticated client**
   - Escopo de idempotência: **escopo do cliente autenticado** + Idempotency-Key (removido merchantId).
   - Nota MVP: não assume multi-tenant; evolução futura tenantId.
   - Checklist § 3.4: IdempotencyService e ProvidersService como nomes padrão; § 3.5: rotas versionadas /v1.

9. **docs(c4): align terminology removing tenant-centric wording**
   - context.md e container.md: nota explícita sobre escopo do cliente autenticado e MVP; rotas /v1.
   - components.md: ProvidersService como contrato principal (sem alias ProviderGateway).
   - Texto e descrições usando apenas "escopo do cliente autenticado" onde antes havia tenant/merchant.

10. **docs(readme): document authorization and correlation id headers**
    - Seção Security Model: Authorization obrigatório, Idempotency-Key para criação, X-Correlation-Id para rastreabilidade.
    - Headers obrigatórios em fluxos 2.1 e 2.2; referência a rotas /v1 e OpenAPI.

11. **docs(review): finalize integration review and close resolved issues**
    - § 1.1: Pendências abertas substituídas por resumo dos ajustes aplicados (versionamento, nomes de serviços, escopo idempotência).
    - § 1.2: Inclusão de itens resolvidos (mapeamento payer/payee, estados, endpoint by-idempotency-key, README Security Model).
    - Plano de implementação e commits sugeridos atualizados para /v1 e escopo do cliente autenticado.

12. **docs(requirements,roadmap): align observability and metrics with client scope**
    - requirements: logs com escopo do cliente (não tenantId); autorização por escopo do cliente.
    - roadmap: métricas por escopo do cliente (evolução: por tenant); requirements referências a GET /v1/... por idempotency-key.

---

*Gerado pelo agente Documentation Harmonizer e Documentation Final Harmonizer. Não implementa código; apenas documentação.*
