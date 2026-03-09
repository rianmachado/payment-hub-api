# Diagramas C4 — Payment Hub API

Arquivos fonte Mermaid (`.mmd`) dos diagramas C4. Os mesmos diagramas estão embutidos nos documentos `context.md`, `container.md` e `components.md` em `docs/c4/`.

## Gerar imagens (PNG/SVG)

É necessário [Node.js](https://nodejs.org/). O [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) pode ser executado via `npx` sem instalação global:

```bash
npx -y @mermaid-js/mermaid-cli -i context.mmd -o context.png
```

Opcional (instalação global):

```bash
npm install -g @mermaid-js/mermaid-cli
# Uso: mmdc -i context.mmd -o context.png  (algumas versões expõem o binário como mmdc)
```

### Gerar PNG e SVG

Na pasta `docs/c4/diagrams/` (use `npx` sem o subcomando `mmdc`):

```bash
# PNG
npx -y @mermaid-js/mermaid-cli -i context.mmd -o context.png
npx -y @mermaid-js/mermaid-cli -i container.mmd -o container.png
npx -y @mermaid-js/mermaid-cli -i components.mmd -o components.png

# SVG
npx -y @mermaid-js/mermaid-cli -i context.mmd -o context.svg
npx -y @mermaid-js/mermaid-cli -i container.mmd -o container.svg
npx -y @mermaid-js/mermaid-cli -i components.mmd -o components.svg
```

Ou execute o script PowerShell (na mesma pasta):

```powershell
.\generate-images.ps1
```

A partir da raiz do repositório:

```bash
npx -y @mermaid-js/mermaid-cli -i docs/c4/diagrams/context.mmd -o docs/c4/diagrams/context.png
npx -y @mermaid-js/mermaid-cli -i docs/c4/diagrams/container.mmd -o docs/c4/diagrams/container.png
npx -y @mermaid-js/mermaid-cli -i docs/c4/diagrams/components.mmd -o docs/c4/diagrams/components.png
```

### Observação

Os diagramas usam a sintaxe **C4** do Mermaid (C4Context, C4Container, C4Component). Requer uma versão do Mermaid que suporte C4 (ex.: mermaid-cli 10+). Se a geração falhar, atualize o mermaid-cli:

```bash
npm update -g @mermaid-js/mermaid-cli
```

## Arquivos

| Arquivo         | Descrição                            |
|-----------------|--------------------------------------|
| `context.mmd`   | Nível 1 — Contexto do sistema       |
| `container.mmd` | Nível 2 — Contêineres                |
| `components.mmd`| Nível 3 — Componentes (módulos NestJS) |
| `context.png`, `context.svg`   | Imagens geradas (contexto)   |
| `container.png`, `container.svg`| Imagens geradas (contêineres)|
| `components.png`, `components.svg` | Imagens geradas (componentes) |

As imagens geradas (`*.png`, `*.svg`) podem ser commitadas no repositório para visualização em README, wikis ou documentação estática.
