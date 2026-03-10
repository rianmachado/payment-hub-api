## Roadmap — Payment Hub API

### Fase A — MVP funcional

- **Escopo principal**  
  - Fluxo de criação de pagamento síncrono básico  
    - Registro de intenção com `paymentId`, estados `CREATED`/`PENDING`/`FAILED` (vocabulário da API; ver data-state para mapeamento interno).  
    - Associação e persistência de `Idempotency-Key` e `correlationId`.  
  - Fluxo de consulta de pagamento  
    - Consulta por `paymentId` com retorno de estado atual e dados principais.  
    - **Consulta por chave de idempotência**: `GET /payments/by-idempotency-key/{idempotencyKey}` — parte da Fase A (já presente em requirements, OpenAPI e C4).  
  - Idempotência mínima (Fase A)  
    - Tratamento de `Idempotency-Key` com comportamento de replay compatível: primeira criação → 201; replay compatível → 200 OK; conflito de payload → 409 básico.  
    - Escopo da chave: cliente autenticado (evolução futura: multi-tenant).  

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

- **Idempotência avançada (Fase B)**  
  - Fase A já cobre: replay compatível, 409 básico quando payload difere, e endpoint `GET /payments/by-idempotency-key/{idempotencyKey}`.  
  - Fase B: evoluções opcionais — comparação canônica completa de payload, retenção/expiração configurável de chaves, replay avançado ou políticas de TTL/limpeza.

- **NFR reforçados**  
  - Métricas de negócio (pagamentos por status, por método, por escopo do cliente; evolução: por tenant).  
  - Dashboards básicos de observabilidade.  
  - Rate limiting por cliente + proteção contra bursts.  
  - Melhorias de segurança (hardening de headers, CSP, validação mais robusta de tokens, etc., conforme contexto).  

- **Resiliência e integração**  
  - Timeouts, circuit breakers e política de retries para integrações externas (quando forem introduzidas).  
  - Tratamento explícito de estados intermediários (`PENDING`) durante falhas transitórias.  

- **Qualidade e governança**  
  - Padronização de modelo de erro `{code,message,details?,correlationId}` em todos os endpoints.  
  - Testes automatizados básicos (unitários e alguns de integração) cobrindo fluxos principais e cenários de idempotência.
