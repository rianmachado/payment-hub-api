# Payment Hub API

API para orquestracao de pagamentos, com foco em consistencia de contratos, idempotencia e evolucao incremental por camadas.

Este `README.md` e a porta de entrada tecnica do projeto: explica como iniciar localmente, como navegar na documentacao funcional e nao funcional, e como usar os artefatos de `docs/postman`.

## Objetivo do projeto

- Expor endpoints de pagamentos alinhados ao contrato OpenAPI.
- Garantir comportamento previsivel para reenvio de requisicoes (idempotencia).
- Manter separacao de responsabilidades entre camadas HTTP, aplicacao e modulos de infraestrutura.

## Stack e requisitos

- `Node.js >= 24`
- `npm`
- `NestJS` + `TypeScript`
- `ESLint` + `Prettier`

Verificacao rapida:

```bash
node -v
npm -v
```

## Quick Start

1. Clonar projeto e instalar dependencias:

```bash
git clone <repo-url>
cd payment-hub-api
npm install
```

2. Configurar ambiente local:

```bash
cp .env.example .env
```

3. Subir aplicacao:

```bash
npm run start:dev
```

4. Validar health check:

```bash
curl http://localhost:3000/health
```

Resposta esperada: `200` com payload de status (ex.: `{ "status": "ok" }`).

## Scripts principais

| Script | Uso |
|---|---|
| `npm run build` | Compila o projeto |
| `npm run start` | Inicia aplicacao |
| `npm run start:dev` | Desenvolvimento com watch |
| `npm run start:debug` | Desenvolvimento com debug |
| `npm run start:prod` | Execucao do build em producao |
| `npm run lint` | Lint e correcoes aplicaveis |
| `npm run format` | Formatacao com Prettier |

## Arquitetura de implementacao (por etapas)

Com base nos prompts dos agentes de implementacao, a construcao do sistema segue este fluxo:

1. `setup`: base tecnica, tooling, `ConfigModule`, scripts, `/health`.
2. `modules`: scaffolding dos modulos centrais e boundaries.
3. `dto`: contratos de API e validacao de entrada.
4. `idempotency`: base de chave idempotente, replay/conflito.
5. `payment-service`: orquestracao da aplicacao (sem responsabilidades HTTP).
6. `controller`: exposicao de endpoints finos, delegando ao service.

Esse encadeamento evita acoplamento precoce e facilita rastreabilidade por commit e por responsabilidade.

## Como ler a documentacao do projeto

Use a sequencia abaixo para onboarding tecnico completo:

1. Visao funcional e escopo:
   - `docs/requirements.md`
2. Estados e ciclo de vida de pagamento:
   - `docs/data-state.md`
3. Contrato HTTP da API:
   - `docs/api/openapi.md`
4. Qualidade, criterios e restricoes:
   - `docs/quality.md`
5. Roadmap e evolucao planejada:
   - `docs/roadmap.md`
6. Arquitetura e boundaries:
   - `docs/c4/`
7. Historico de execucao por branch/commit:
   - `docs/dev-commit-logs/`

## Guia dos artefatos Postman (`docs/postman`)

O projeto possui dois artefatos versionados:

- `docs/postman/payment-hub-api.postman_collection.json`
- `docs/postman/payment-hub-api.local.postman_environment.json`

Uso recomendado:

1. Importe os dois arquivos no Postman (Collection + Environment).
2. Selecione o environment local antes de executar requisicoes.
3. Confira variaveis de ambiente (ex.: base URL e headers) e ajuste se necessario para sua maquina.
4. Execute primeiro o endpoint de health e depois os fluxos de pagamento.
5. Em alteracoes de contrato, atualize os artefatos junto com o OpenAPI para evitar divergencia.

Boas praticas:

- Trate OpenAPI como fonte de verdade para contratos.
- Use a collection como acelerador de teste manual e smoke test local.
- Versione alteracoes da collection/environment no mesmo contexto da mudanca de API.

## Visao geral dos agentes (`agents/dev/`)

Os agentes de `agents/dev/implementation-executor/` organizam a implementacao por etapas e ajudam a manter escopo controlado por commit.

- `setup`: prepara base tecnica (tooling, env, scripts, health check).
- `modules`: cria estrutura de modulos e wiring minimo.
- `dto`: define contratos de API e validacoes de entrada.
- `idempotency`: estrutura validacao de `Idempotency-Key` e base de replay/conflito.
- `payment-service`: implementa orquestracao de aplicacao (sem camada HTTP).
- `controller`: expoe endpoints HTTP conforme OpenAPI, com controller fino.

Diretriz de uso:

- Leia primeiro `docs/requirements.md` e `docs/api/openapi.md`.
- Use os agentes como guia de execucao tecnica (nao como fonte de regra de negocio).
- Registre evidencias de entrega em `docs/dev-commit-logs/`.

## Estrutura de pastas relevante

```text
payment-hub-api/
|-- src/                        # Codigo da aplicacao
|-- docs/                       # Documentacao funcional e tecnica
|   |-- api/                    # Contrato OpenAPI
|   |-- c4/                     # Arquitetura
|   |-- postman/                # Collection e environment
|   `-- dev-commit-logs/        # Logs de implementacao por branch
|-- agents/                     # Prompts e guias dos agentes de execucao
|-- .env.example
`-- README.md
```

## Convencoes e qualidade

- TypeScript em modo estrito.
- Lint e formatacao obrigatorios.
- Endpoints alinhados ao `docs/api/openapi.md`.
- Mudancas devem respeitar boundaries definidos no C4.

## Proximos passos para quem esta comecando

- Rodar `npm run build` e `npm run start:dev`.
- Validar `GET /health`.
- Executar collection do Postman no ambiente local.
- Ler `docs/requirements.md` e `docs/api/openapi.md` antes de implementar novas features.
