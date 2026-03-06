## Roadmap — Payment Hub API

### Fase A — MVP funcional

- **Escopo principal**  
  - Fluxo de criação de pagamento síncrono básico  
    - Registro de intenção com `paymentId`, estados `CREATED`/`PENDING`/`FAILED`.  
    - Associação e persistência de `Idempotency-Key` e `correlationId`.  
  - Fluxo de consulta de pagamento  
    - Consulta por `paymentId` com retorno de estado atual e dados principais.  
  - Idempotência mínima  
    - Tratamento de `Idempotency-Key` com comportamento de replay compatível: primeira criação → 201; replay compatível → 200 OK; conflito de payload → 409 básico.
    - Consulta por chave: `GET /payments/by-idempotency-key/{idempotencyKey}` (Fase A ou B).  

- **Regras de negócio mínimas**  
  - Validações sintáticas e de campos obrigatórios.  
  - Regras simples de rejeição (ex.: amount <= 0, moeda não suportada).  

- **NFR básicos**  
  - Logs estruturados básicos.  
  - `correlationId` em criação e consulta.  
  - Autenticação obrigatória.  

- **Entrega esperada**  
  - Documentação atualizada em `docs/requirements.md`.  
  - Endpoints principais documentados em alto nível.  


### Fase B — Hardening mínimo

- **Robustez de domínio e regras**  
  - Definição clara de business key e reforço de invariantes de duplicidade.  
  - Implementação de modelo de estado completo (`AUTHORIZED`, `SETTLED`, `CANCELLED`, etc.).  
  - Tratamento completo de cancelamentos (se suportado pelo contexto).  

- **Idempotência avançada**
  - Fase A: replay compatível + 409 básico quando payload difere. Fase B: comparação canônica completa de payload para detecção de `PAYMENT_IDEMPOTENCY_CONFLICT` e retenção/expiração de chaves idempotentes.
  - `GET /payments/by-idempotency-key/{idempotencyKey}` disponível para consulta (incluir em Fase A ou B conforme prioridade).

- **NFR reforçados**  
  - Métricas de negócio (pagamentos por status, por método, por tenant).  
  - Dashboards básicos de observabilidade.  
  - Rate limiting por cliente + proteção contra bursts.  
  - Melhorias de segurança (hardening de headers, CSP, validação mais robusta de tokens, etc., conforme contexto).  

- **Resiliência e integração**  
  - Timeouts, circuit breakers e política de retries para integrações externas (quando forem introduzidas).  
  - Tratamento explícito de estados intermediários (`PENDING`) durante falhas transitórias.  

- **Qualidade e governança**  
  - Padronização de modelo de erro `{code,message,details?,correlationId}` em todos os endpoints.  
  - Testes automatizados básicos (unitários e alguns de integração) cobrindo fluxos principais e cenários de idempotência.
