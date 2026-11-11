#Requires -Version 5.1
<#
  LyricLume 卸载脚本
#>
$ErrorActionPreference = 'Continue'

$InstallDir = Join-Path $env:LOCALAPPDATA 'LyricLume'
$SpData     = Join-Path $env:APPDATA 'spicetify'
$Ini        = Join-Path $SpData 'config-xpui.ini'
$ExtName    = 'lyriclume.js'

Write-Host "`n  LyricLume 卸载  `n" -ForegroundColor White

# 1. 停掉代理
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*LyricLume*proxy.mjs*' }
foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
if ($procs) { Write-Host "  OK  已停止代理进程" -ForegroundColor Green }

# 2. 删除自启快捷方式
$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'LyricLume Proxy.lnk'
if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Host "  OK  已删除开机自启" -ForegroundColor Green }

# 3. 从 Spicetify 配置里摘掉
if (Test-Path $Ini) {
  $lines = [System.IO.File]::ReadAllLines($Ini)
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*extensions\s*=') {
      $cur = ($lines[$i] -split '=', 2)[1].Trim()
      $list = @()
      if ($cur) { $list = @($cur -split '\|' | Where-Object { $_ -and $_ -ne $ExtName }) }
      $lines[$i] = 'extensions            = ' + ($list -join '|')
      break
    }
  }
  [System.IO.File]::WriteAllLines($Ini, $lines, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "  OK  已从配置里移除扩展" -ForegroundColor Green

  $sp = (Get-Command spicetify -ErrorAction SilentlyContinue).Source
  if (-not $sp) {
    $cand = Join-Path $env:LOCALAPPDATA 'Spicetify\spicetify.exe'
    if (Test-Path $cand) { $sp = $cand }
  }
  if ($sp) { & $sp apply | Out-Null; Write-Host "  OK  已重新应用补丁" -ForegroundColor Green }
}

# 4. 删除扩展文件
$ext = Join-Path $SpData "Extensions\$ExtName"
if (Test-Path $ext) { Remove-Item $ext -Force; Write-Host "  OK  已删除扩展文件" -ForegroundColor Green }

# 5. 删除程序目录
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force; Write-Host "  OK  已删除 $InstallDir" -ForegroundColor Green }

# 6. 询问是否清理缓存
$cache = Join-Path $env:LOCALAPPDATA 'Spotify\Local Storage\leveldb'
Write-Host "`n  歌词缓存存在 Spotify 的 localStorage 里（键名前缀 qql.lyric.）。" -ForegroundColor DarkGray
Write-Host "  Spicetify 本身没删，要还原 Spotify 原始文件请运行：spicetify restore`n" -ForegroundColor DarkGray

Write-Host "  卸载完成，重启 Spotify 生效`n" -ForegroundColor White
