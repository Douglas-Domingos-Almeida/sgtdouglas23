# Gera js/news-data.js a partir de conteudo/noticias/*.md.
# Rode novamente sempre que uma materia for alterada: .\scripts\gerar-noticias.ps1
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sources = [ordered]@{}

Get-ChildItem -LiteralPath (Join-Path $root 'conteudo\noticias') -Filter 'Noticia(*).md' |
  Sort-Object { [int]($_.BaseName -replace '\D', '') } |
  ForEach-Object { $sources[$_.Name] = [IO.File]::ReadAllText($_.FullName, $utf8) }

$json = $sources | ConvertTo-Json -Depth 3
$header = "// Arquivo gerado por scripts/gerar-noticias.ps1. Nao edite manualmente.`n"
[IO.File]::WriteAllText((Join-Path $root 'js\news-data.js'), "${header}window.NEWS_SOURCES = $json;`n", $utf8)
Write-Output "news-data.js gerado com $($sources.Count) materias."
