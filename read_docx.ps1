Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxFile = Get-ChildItem -Filter "*.docx" | Select-Object -First 1
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxFile.FullName)
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()
$clean = [System.Text.RegularExpressions.Regex]::Replace($content, "<[^>]+>", " ")
$clean = [System.Text.RegularExpressions.Regex]::Replace($clean, "\s+", " ")
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "scratch_docx.txt"), $clean, [System.Text.Encoding]::UTF8)
Write-Output "Successfully written text"
