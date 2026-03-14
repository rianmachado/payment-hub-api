# Step 6 — feat(exception-filters): standardize error handling layer

**Commit (implementação):** `feat(exception-filters): standardize error handling layer`

- Exception Filter global: corpo `{ code, message, details?, correlationId }`; mapeamento exceções → status/códigos; sem vazamento de stack em prod.
- Ref.: `docs/requirements.md`, `docs/api/openapi.md` (§ 3, § 6), `docs/quality.md` (§ 3.6).
