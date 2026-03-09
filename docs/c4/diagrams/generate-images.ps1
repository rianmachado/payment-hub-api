# Gera imagens PNG e SVG dos diagramas C4 a partir dos arquivos .mmd
# Requer: Node.js e npx (mermaid-cli será baixado automaticamente)
# Uso: .\generate-images.ps1   (execute na pasta docs/c4/diagrams ou na raiz do repo)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Diagrams = @("context", "container", "components")

foreach ($name in $Diagrams) {
    $mmd = Join-Path $ScriptDir "$name.mmd"
    if (-not (Test-Path $mmd)) {
        Write-Warning "Arquivo não encontrado: $mmd"
        continue
    }
    foreach ($ext in @("png", "svg")) {
        $out = Join-Path $ScriptDir "$name.$ext"
        Write-Host "Gerando $out ..."
        if ($ext -eq "png") {
            npx -y @mermaid-js/mermaid-cli -i $mmd -o $out -b transparent
        } else {
            npx -y @mermaid-js/mermaid-cli -i $mmd -o $out
        }
        if (Test-Path $out) { Write-Host "  OK: $out" } else { Write-Warn "  Falha: $out" }
    }
}
Write-Host "Concluído."
