# Gera imagens PNG dos diagramas C4 a partir dos arquivos .drawio
# Requer: Node.js e npx (draw.io-export será baixado automaticamente)
# Uso: .\generate-images.ps1   (execute na pasta docs/c4/diagrams)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Diagrams = @("context", "container", "components")

foreach ($name in $Diagrams) {
    $drawio = Join-Path $ScriptDir "$name.drawio"
    if (-not (Test-Path $drawio)) {
        Write-Warning "Arquivo não encontrado: $drawio"
        continue
    }
    $png = Join-Path $ScriptDir "$name.png"
    Write-Host "Gerando $png ..."
    npx -y draw.io-export $drawio -o $png
    if (Test-Path $png) { Write-Host "  OK: $png" } else { Write-Warning "  Falha: $png" }
}
Write-Host "Concluído."
