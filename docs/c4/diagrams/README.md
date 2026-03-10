# Diagramas C4 — Payment Hub API

Diagramas C4 em formato **draw.io** (XML), editáveis em [app.diagrams.net](https://app.diagrams.net) ou no Draw.io desktop. Cada ligação entre elementos possui **sequência numerada** (1, 2, 3, …) para leitura da ordem das interações.

## Arquivos

| Arquivo           | Descrição                                              |
|-------------------|--------------------------------------------------------|
| `context.drawio`  | Nível 1 — Contexto do sistema (Person, System, externos) |
| `container.drawio`| Nível 2 — Contêineres (boundary Payment Hub API + externos) |
| `components.drawio` | Nível 3 — Componentes (módulos NestJS dentro do hub) |
| `context.png`     | Imagem PNG do diagrama de contexto (gerada)           |
| `container.png`   | Imagem PNG do diagrama de contêineres (gerada)        |
| `components.png`  | Imagem PNG do diagrama de componentes (gerada)        |

## Gerar imagens PNG

É necessário [Node.js](https://nodejs.org/). Use o pacote [draw.io-export](https://www.npmjs.com/package/draw.io-export) para exportar cada `.drawio` para PNG:

```bash
# Na pasta docs/c4/diagrams/
npx -y draw.io-export context.drawio -o context.png
npx -y draw.io-export container.drawio -o container.png
npx -y draw.io-export components.drawio -o components.png
```

A partir da raiz do repositório:

```bash
npx -y draw.io-export docs/c4/diagrams/context.drawio -o docs/c4/diagrams/context.png
npx -y draw.io-export docs/c4/diagrams/container.drawio -o docs/c4/diagrams/container.png
npx -y draw.io-export docs/c4/diagrams/components.drawio -o docs/c4/diagrams/components.png
```

Ou execute o script PowerShell (na pasta `diagrams/`):

```powershell
.\generate-images.ps1
```

## Editar os diagramas

1. Abra [app.diagrams.net](https://app.diagrams.net) (ou Draw.io desktop).
2. **Arquivo → Abrir** e selecione o `.drawio` desejado.
3. Edite e salve. Para exportar manualmente: **Arquivo → Exportar como → PNG**.

As imagens PNG podem ser commitadas no repositório para uso em README, wikis ou documentação estática.
