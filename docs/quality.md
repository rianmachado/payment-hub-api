# Payment Hub — Qualidade e Operação (STA)

Documento de padrões mínimos de qualidade, observabilidade, segurança e checklist por camada Nest, alinhado aos requisitos e à API do Payment Hub (simplificado).

---

## 1. Observabilidade mínima

### 1.1 Padrão de X-Correlation-Id (geração e propagação)

- **Header padrão**: usar sempre o header `X-Correlation-Id` em todas as chamadas HTTP de entrada e saída do Payment Hub.
- **Geração na borda**:
  - Se a requisição de entrada **não** possuir `X-Correlation-Id`, gerar um novo identificador (UUID v4, 36 caracteres) no primeiro ponto de entrada HTTP (API Gateway / BFF / API Nest).
  - Se já existir `X-Correlation-Id`, **reutilizar o valor recebido** (nunca sobrescrever).
- **Propagação interna**:
  - Tornar o `X-Correlation-Id` obrigatório no contexto de request (por exemplo, em contexto assíncrono ou request-scope) para que:
    - Todos os logs da requisição incluam o mesmo `correlationId`.
    - Toda chamada a providers externos reenvie o `X-Correlation-Id` no header.
    - Qualquer publicação em filas/eventos inclua o `correlationId` no payload/event metadata.
- **Resposta ao cliente**:
  - Sempre devolver o header `X-Correlation-Id` na resposta HTTP, mesmo em erros.
- **Erros e replays**:
  - Em operações de replay/manual, manter o `X-Correlation-Id` original como campo de referência de auditoria e gerar **novo** `X-Correlation-Id` para o novo fluxo, vinculando ambos em log/auditoria.

### 1.2 Logging estruturado

- **Formato e nível mínimo**:
  - Logs em formato **estruturado** (JSON) com, no mínimo, os campos:
    - `timestamp`, `level`, `message`
    - `service`, `environment`, `version`
    - `correlationId`, `requestId` (se houver), `idempotencyKey` (se houver)
    - `httpMethod`, `path`, `statusCode`, `durationMs`
    - `provider`, `operation` (ex.: `authorize`, `capture`, `refund`) quando aplicável
    - `paymentId`, `transactionId` (quando disponíveis)
    - Dados de erro: `errorName`, `errorCode`, `errorMessage`, `stack` (apenas em ambiente não-prod ou truncada/mapeada em prod)
  - Níveis de log:
    - `INFO`: fluxo normal, eventos de negócio (ex.: criação de pagamento, mudança de estado).
    - `WARN`: comportamentos anômalos não fatais (timeouts recuperáveis, replays, inconsistências tratadas).
    - `ERROR`: falhas que impedem o fluxo normal (falha em provider, erro de banco, exceções não esperadas).
    - `DEBUG`/`TRACE`: apenas em ambientes de desenvolvimento ou troubleshooting controlado.
- **O que logar (mínimo)**:
  - Identificadores de negócio: `paymentId`, `transactionId`, `providerTransactionId`, `merchantId`.
  - Estados de pagamento: estado anterior → novo estado (ex.: `PENDING` → `AUTHORIZED`).
  - Eventos de integração com providers:
    - Chamada enviada (sem payload sensível): endpoint, método, headers não sensíveis, tempo de resposta, status code.
    - Resposta recebida (apenas campos necessários para rastreabilidade e debug, sem dados sensíveis).
  - Decisões de idempotência:
    - Quando uma requisição é tratada como **replay** (reutilização de resposta anterior).
  - Decisões de segurança:
    - Falhas de autenticação/autorização (sem expor credenciais).
- **O que NÃO logar**:
  - **NUNCA** logar dados de cartão (PAN completo, CVV, data de validade), senhas, tokens de 2FA, chaves privadas, secrets, API keys, tokens de acesso JWT brutos.
  - Não logar bodies completos de requisição/resposta de providers quando contiverem dados sensíveis de pagamento.
  - Não logar dados pessoais em texto claro além de identificadores necessários (evitar nome completo, endereço, documentos, e-mail, telefone; preferir IDs internos/pseudônimos).
  - Não logar dumps de objetos de configuração/env (`process.env`, etc.).
- **Requisitos de consistência**:
  - Todo log relacionado a uma requisição HTTP deve conter o mesmo `correlationId`.
  - Toda exceção não tratada deve ser capturada por um `Exception Filter` global e registrada com nível `ERROR`.

### 1.3 Métricas conceituais

- **Latência por endpoint**:
  - Métrica de latência por par `método + rota` (ex.: `http_server_requests_duration_ms{method="POST",route="/payments"}`).
  - Expor pelo menos:
    - `avg` (média)
    - `p95` (percentil 95)
    - `p99` (percentil 99)
  - Segregar por:
    - Ambiente (dev/stage/prod)
    - Tipo de cliente (se aplicável, ex.: admin vs integração externa).
- **Taxa de erro**:
  - Métrica de contagem de requisições por status de resultado:
    - `success` (2xx)
    - `client_error` (4xx)
    - `server_error` (5xx)
  - Quebrar por endpoint, método HTTP e, se possível, tipo de erro lógico (ex.: `BUSINESS_VALIDATION_ERROR`, `PROVIDER_TIMEOUT`, `DB_ERROR`).
- **Replays / idempotência**:
  - Contabilizar:
    - Total de requisições idempotentes recebidas.
    - Quantidade de **replays detectados** (mesmo idempotency key).
    - Quantidade de replays que resultaram em reutilização de resposta vs reprocessamento.
  - Métricas sugeridas:
    - `payments_idempotent_requests_total`
    - `payments_replay_detected_total`
    - `payments_replay_with_conflict_total` (quando há conflito de payload para mesma chave).
- **Integração com providers**:
  - Latência por operação de provider (autorização, captura, cancelamento, etc.).
  - Taxa de erro por provider (falha técnica vs recusa de negócio).
  - Taxa de timeout por provider.
- **Saúde geral**:
  - Métrica de fila (se houver filas/eventos): tamanho, idade média das mensagens.
  - Métrica de disponibilidade do serviço (healthcheck bem-sucedido).

---

## 2. Segurança mínima

### 2.1 Proposta de Guards (API key / JWT para admin)

- **API Key Guard (integrações server-to-server)**:
  - Usar `API Key` em headers (ex.: `X-Api-Key`) para:
    - Integrações de sistemas internos que não exigem identidade de usuário final, mas exigem autenticação forte de cliente técnico.
    - Webhooks de providers que suportem autenticação por chave compartilhada.
  - Requisitos:
    - As chaves devem ser geradas de forma randômica, com alta entropia, e armazenadas **somente** em local seguro (secret manager).
    - Rotação de chaves suportada (permitir duas chaves ativas por integração durante janela de migração).
    - Guard centralizado (um único ponto de validação) com:
      - Validação de chave ativa.
      - Verificação de escopo da integração (ex.: apenas leitura, somente criação de pagamentos, etc.).
- **JWT Guard (admin/operacional)**:
  - Usar JWT para proteger endpoints de:
    - Console/admin de Payment Hub.
    - Operações manuais/operações sensíveis (replay de pagamentos, alteração de estado manual, ajustes).
  - O Guard deve:
    - Validar assinatura do token (algoritmo forte, ex.: RS256 ou HS256 com segredo robusto).
    - Validar `exp` (expiração), `iat` (issued-at), `aud` (audience) e `iss` (issuer) conforme configurado.
    - Extrair escopos/roles do token e validar as permissões do endpoint.

### 2.2 Escopo do JWT (quando aplicável)

- **Claims mínimos**:
  - `sub`: identificador único do usuário (id interno).
  - `roles` ou `permissions`: lista de perfis (ex.: `admin`, `support`, `read-only`).
  - `aud`: identificador do cliente/serviço alvo (ex.: `payment-hub-admin`).
  - `iss`: emissor confiável (ex.: IdP corporativo).
  - `exp` e `iat`: controle de validade do token.
- **Escopos/roles sugeridos**:
  - `admin`:
    - Acesso total a operações de configuração e manutenção (restrito).
  - `operations`:
    - Pode disparar replays, reagendar mensagens, consultar detalhes de pagamento.
    - Não pode alterar configurações sensíveis de segurança.
  - `support-readonly`:
    - Apenas consulta de dados de pagamento/auditoria.
- **Regras gerais**:
  - Tokens devem ter **vida curta** (short-lived), com refresh feito fora do Payment Hub.
  - Não incluir dados sensíveis ou PII desnecessária dentro do JWT (usar apenas IDs internos).
  - Toda decisão de autorização deve ser auditável (quem executou o quê, quando, em qual recurso).

---

## 3. Checklist por camada Nest (itens verificáveis)

### 3.1 Modules

- [ ] Cada `Module` encapsula um contexto claro (ex.: `PaymentsModule`, `ProvidersModule`, `AuthModule`).
- [ ] Cada `Module` expõe apenas os providers necessários via `exports` (evitar módulos "Deus").
- [ ] Configurações de ambiente são centralizadas em um módulo de configuração (ex.: `ConfigModule`) e injetadas, não lidas diretamente do ambiente em todo lugar.
- [ ] Módulos globais são usados com parcimônia (apenas para infraestrutura transversal: logging, auth, config).
- [ ] Healthcheck/actuator disponíveis em módulo dedicado (ex.: `HealthModule`), sem depender de lógica de domínio.

### 3.2 DTO / Validation / Pipes / Middlewares

- [ ] Todo endpoint público utiliza DTOs explícitos para **request** e **response** (sem uso de `any` ou objetos soltos).
- [ ] DTOs de entrada possuem validações declarativas (ex.: obrigatoriedade, formatos, ranges, enums).
- [ ] Global Validation Pipe configurado para:
  - [ ] Remover campos não previstos (`whitelist`).
  - [ ] Rejeitar campos desconhecidos (`forbidNonWhitelisted`) em ambientes de prod.
- [ ] Transformações simples (parse de tipos básicos, normalização de enums) são implementadas em `Pipes`, **não** em controllers/services.
- [ ] `Middlewares` só tratam cross-cutting concerns (logging de request, extração de `correlationId`, etc.), sem lógica de negócio.

### 3.3 TypeORM

- [ ] `synchronize` desabilitado em ambientes não-test (uso obrigatório de migrations).
- [ ] Todas as entidades de domínio de pagamento têm:
  - [ ] Chaves primárias claras.
  - [ ] Índices adequados para consultas frequentes.
  - [ ] Restrições de unicidade para chaves de idempotência quando aplicável.
- [ ] Operações que alteram múltiplas tabelas/estados críticos usam transações.
- [ ] Não há montagem de SQL manual com concatenação de strings com input de usuário (sempre parâmetros tipados ou query builder).
- [ ] Soft delete habilitado onde exigido por auditoria, em vez de exclusão física imediata.

### 3.4 Services

- [ ] Controladores são finos: lógica de negócio reside em `Services`.
- [ ] Serviços são focados em um propósito (ex.: `PaymentsService`, `ProvidersService`, `IdempotencyService`).
- [ ] Lógica de idempotência e transição de estado de pagamento é centralizada em serviços específicos, reutilizada por todos os fluxos (API, callbacks, replays).
- [ ] Serviços lidam explicitamente com falhas de provider (timeouts, erros de rede, recusas de negócio).
- [ ] Serviços são testáveis isoladamente (sem depender de HTTP ou infraestrutura externa sempre que possível).

### 3.5 Controllers

- [ ] Cada rota está versionada (ex.: prefixo `/v1`) conforme padrão da API, ou versionamento marcado como evolução futura no checklist.
- [ ] Controllers apenas:
  - [ ] Recebem/parsing de DTOs.
  - [ ] Delegam para serviços.
  - [ ] Mapeiam resultado para contratos de resposta da API.
- [ ] Códigos HTTP retornados seguem o contrato (2xx para sucesso, 4xx para erros de cliente, 5xx para erros de servidor).
- [ ] Controllers **não** acessam diretamente repositórios/banco de dados.

### 3.6 Exception Filters

- [ ] Existe um `Exception Filter` global que:
  - [ ] Converte erros técnicos genéricos em formato de erro padronizado da API.
  - [ ] Garante inclusão do `correlationId` no payload de erro.
  - [ ] Em produção, não expõe stack trace nem mensagens internas sensíveis.
- [ ] Erros de validação (DTO/Validation) retornam código e estrutura padronizados.

### 3.7 Interceptors

- [ ] Interceptor de logging de request/response em nível de controller (registrando latência, status e `correlationId`).
- [ ] Interceptor de timeout configurado para requests externos (providers) e, se necessário, para rotas internas mais custosas.
- [ ] Interceptor de métrica (coleta tempo de processamento e contagem de requests por endpoint).

### 3.8 Guards

- [ ] Guard de `API Key` aplicado a endpoints que exigem autenticação técnica de integração.
- [ ] Guard de `JWT` aplicado a endpoints admin/operacionais.
- [ ] Uso de metadata/roles em decorators para definir permissões por rota (ex.: apenas `admin` para operações críticas).
- [ ] Falhas de autenticação/autorização são retornadas em formato padronizado e logadas com nível adequado.

### 3.9 Auth JWT

- [ ] Validação de assinatura, `issuer`, `audience`, `exp` e `iat` em um único componente de autenticação.
- [ ] Extração de identidade e roles do token em objeto de contexto acessível em toda a aplicação.
- [ ] Não há uso do JWT como fonte de verdade para dados sensíveis (apenas identificadores, sem PII).
- [ ] Suporte a rotação de chaves/segredos sem downtime (aceitar chave antiga durante janela de migração planejada).

---

## 4. STA — Riscos operacionais e mitigação

### 4.1 Replay / duplicidade

- **Risco**:
  - Requisições repetidas (por retry de cliente, instabilidade de rede ou reenvio manual) causando múltiplas autorizações/capturas para o mesmo pagamento.
- **Mitigação**:
  - Exigir header ou identificador de idempotência por operação sensível (ex.: criação de pagamento, autorização).
  - Persistir chave de idempotência com:
    - Estado atual da operação.
    - Resultado retornado (para poder reutilizar resposta).
  - Garantir unicidade da combinação (`idempotencyKey` + tipo de operação + `merchantId`).
  - Em replay detectado, **não reprocessar** a operação; reutilizar a resposta já registrada e logar evento de replay.

### 4.2 Inconsistência de estado

- **Risco**:
  - Divergência entre o estado interno do Payment Hub e o estado real no provider (ex.: Payment Hub em `AUTHORIZED`, provider em `CANCELLED`).
- **Mitigação**:
  - Modelar o fluxo de pagamento como **máquina de estados** explícita, com transições válidas bem definidas.
  - Usar transações no banco para mudanças de estado e gravação de eventos correlatos.
  - Criar jobs de reconciliação periódica com providers (consulta de status oficial e ajuste controlado).
  - Registrar todos os eventos de mudança de estado em trilha de auditoria (quem/quê/quando).

### 4.3 Conflitos de idempotência

- **Risco**:
  - Mesma chave de idempotência usada com payload diferente (ex.: mesmo `idempotencyKey`, valores de pagamento distintos).
- **Mitigação**:
  - Ao registrar uma nova requisição idempotente, comparar payload relevante com o payload previamente associado à chave.
  - Em caso de divergência:
    - Registrar log de `WARN`/`ERROR` com detalhes não sensíveis.
    - Retornar erro claro de conflito de idempotência para o cliente.
  - Documentar claramente o escopo da idempotência (por ex.: por `merchantId` + operação + `idempotencyKey`).

### 4.4 Timeouts de provider (mesmo em mock)

- **Risco**:
  - Providers reais ou mocks demorando além do esperado, causando saturação de conexões/threads e degradação do Payment Hub.
- **Mitigação**:
  - Definir timeout padrão e máximo para todas as chamadas a providers (ex.: alguns segundos) e **nunca** deixar chamadas bloqueantes indefinidamente.
  - Implementar política de retry com backoff exponencial apenas quando aplicável (erros transitórios) e com limite máximo de tentativas.
  - Registrar métricas de timeout por provider e acionar alertas com base em limiares.
  - Em ambiente de mock:
    - Garantir que mocks também respeitem tempos de resposta configuráveis para simular cenários de latência e garantir que o timeout do Payment Hub está funcionando.
  - Avaliar uso de padrão de circuit breaker para providers instáveis.

### 4.5 Auditoria mínima

- **Objetivo**:
  - Permitir reconstituir, a partir de registros, **quem** fez **o quê**, **quando** e **com qual resultado**, para operações sensíveis de pagamento.
- **Requisitos mínimos**:
  - Registro de auditoria para:
    - Criação de pagamentos e mudanças de estado (incluindo replays).
    - Ações manuais em console/admin (ex.: forçar cancelamento, reprocessar pagamento, alterar configurações críticas).
  - Campos mínimos de auditoria:
    - Identificador de usuário/cliente técnico (ex.: `userId` ou `clientId`).
    - Identificador de recurso afetado (`paymentId`, `transactionId`, `providerTransactionId`).
    - Tipo de ação (ex.: `CREATE_PAYMENT`, `REPLAY_PAYMENT`, `CANCEL_PAYMENT`).
    - Resultado (`SUCCESS`, `FAILURE`) e motivo/erro quando houver.
    - `correlationId` associado.
    - Timestamp de criação.
  - Armazenamento:
    - Em tabela ou storage dedicado a auditoria (não apenas em log de aplicação), com retenção configurável.
  - Acesso:
    - Endpoints de consulta de auditoria protegidos por JWT/roles apropriados (ex.: `operations`, `support-readonly`).
