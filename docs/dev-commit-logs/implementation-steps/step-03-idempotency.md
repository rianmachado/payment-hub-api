# Step 3 — feat(idempotency): implement idempotency module and key validation

**Commit (implementação):** `feat(idempotency): implement idempotency module and key validation`

- IdempotencyService: first call / replay compatível / conflito; storage (DB/cache); validação Idempotency-Key (máx. 128 caracteres).
- Ref.: `docs/requirements.md`, `docs/data-state.md`, `docs/c4/components.md` (M5), `docs/quality.md` (§ 3.4, § 4.1, § 4.3).
