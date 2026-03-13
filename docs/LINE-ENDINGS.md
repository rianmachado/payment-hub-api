# Fins de linha (LF no Windows)

O repositório usa **LF** (Unix) em todos os arquivos de texto (`.gitattributes`).

## Por que o Git avisa "CRLF will be replaced by LF"?

No Windows, arquivos podem estar em **CRLF** no disco. Ao fazer `git add`, o Git grava no repositório em **LF** e só avisa que fez essa conversão. O aviso some quando os arquivos na pasta de trabalho já estiverem em LF.

## Deixar a pasta de trabalho em LF (uma vez)

**No VS Code / Cursor**

1. Abra a pasta do projeto.
2. Na barra de status (canto inferior direito), clique onde está **CRLF**.
3. Escolha **LF** e depois **"Apply to All"** (aplicar a todos) ou salve cada arquivo.
4. Ou: **File → Save All** depois de garantir que a configuração de EOL do workspace está em LF (`.editorconfig` já define `end_of_line = lf`; feche e reabra a pasta se precisar).

**Pelo Git Bash (após commits feitos)**

```bash
git add --renormalize .
git status
git restore .
```

Isso reaplica o `.gitattributes` e repõe os arquivos da pasta de trabalho a partir do índice (em LF). Use só se não tiver alterações não commitadas que precise manter.

## Trabalhar no VS Code

Pode usar o VS Code normalmente. Ele lida bem com LF e CRLF. Com o `.editorconfig` (e, se quiser, EOL definido como LF no workspace), os arquivos passam a ser salvos em LF e o aviso do Git deixa de aparecer.
