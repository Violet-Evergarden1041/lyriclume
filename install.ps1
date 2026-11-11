#Requires -Version 5.1
<#
  LyricLume 安装脚本
  用法：右键「使用 PowerShell 运行」，或在 PowerShell 里执行 install.ps1
#>
param(
  [switch]$NoProxyStart
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Join-Path $env:LOCALAPPDATA 'LyricLume'
$SpData     = Join-Path $env:APPDATA 'spicetify'
$ExtDir     = Join-Path $SpData 'Extensions'
$Ini        = Join-Path $SpData 'config-xpui.ini'
$ExtName    = 'lyriclume.js'

function Step($n, $m) { Write-Host "`n[$n] $m" -ForegroundColor White }
function Ok($m)       { Write-Host "    OK  $m" -ForegroundColor Green }
function Warn($m)     { Write-Host "    !   $m" -ForegroundColor Yellow }

Write-Host "`n  LyricLume 安装程序  " -ForegroundColor Black -BackgroundColor DarkGreen
Write-Host "  Spotify 逐字歌词 + QQ 音乐中文翻译`n" -ForegroundColor DarkGray

# ---------- 1. Node.js ----------
Step 1 '检查 Node.js'
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  throw "没有找到 Node.js。请先安装：https://nodejs.org/（选 LTS 版），装完重开 PowerShell 再运行本脚本。"
}
$node = $nodeCmd.Source
Ok "Node.js $(& node -v)  ($node)"

# ---------- 2. Spotify ----------
Step 2 '检查 Spotify'
$spotify = Join-Path $env:APPDATA 'Spotify\Spotify.exe'
if (-not (Test-Path $spotify)) {
  $store = Get-ChildItem "$env:ProgramFiles\WindowsApps" -Filter 'SpotifyAB*' -ErrorAction SilentlyContinue
  if ($store) {
    throw "检测到你装的是微软商店版 Spotify。Spicetify 不支持商店版，请卸载后从 https://www.spotify.com/download/windows/ 安装官网版。"
  }
  throw "没有找到 Spotify（预期位置：$spotify）"
}
Ok "Spotify：$spotify"

# ---------- 3. Spicetify ----------
Step 3 '检查 Spicetify'
$sp = (Get-Command spicetify -ErrorAction SilentlyContinue).Source
if (-not $sp) {
  $cand = Join-Path $env:LOCALAPPDATA 'Spicetify\spicetify.exe'
  if (Test-Path $cand) { $sp = $cand }
}
if (-not $sp) {
  Warn '没装 Spicetify，正在自动安装（需要联网，可能要几分钟）…'
  & powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex"
  $cand = Join-Path $env:LOCALAPPDATA 'Spicetify\spicetify.exe'
  if (Test-Path $cand) { $sp = $cand }
  if (-not $sp) { throw "Spicetify 自动安装失败，请手动安装：https://spicetify.app/docs/getting-started" }
}
Ok "Spicetify：$sp"

# ---------- 4. 复制文件 ----------
Step 4 '安装程序文件'
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'server') | Out-Null
Copy-Item (Join-Path $RepoDir 'server\*.mjs') (Join-Path $InstallDir 'server') -Force
Ok "程序文件 → $InstallDir"

# ---------- 5. 安装扩展 ----------
Step 5 '安装 Spotify 扩展'
New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
Copy-Item (Join-Path $RepoDir 'extension\lyriclume.js') (Join-Path $ExtDir $ExtName) -Force
Ok "扩展 → $Env:APPDATA\spicetify\Extensions\$ExtName"

# ---------- 6. 注册到 Spicetify 配置 ----------
Step 6 '注册扩展'
if (-not (Test-Path $Ini)) {
  Warn '没有找到 config-xpui.ini，先执行一次 spicetify backup apply'
  & $sp backup apply | Out-Null
}
$lines = [System.IO.File]::ReadAllLines($Ini)
$idx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^\s*extensions\s*=') { $idx = $i; break }
}
if ($idx -lt 0) { throw "配置文件里没有 extensions 这一行，Spicetify 可能没初始化好。先运行 spicetify backup apply 再试。" }

$cur = ($lines[$idx] -split '=', 2)[1].Trim()
$list = @()
if ($cur) { $list = @($cur -split '\|' | Where-Object { $_ -and $_ -ne $ExtName }) }
$list += $ExtName
$lines[$idx] = 'extensions            = ' + ($list -join '|')
[System.IO.File]::WriteAllLines($Ini, $lines, (New-Object System.Text.UTF8Encoding($false)))
Ok "已注册：$($list -join ', ')"

# ---------- 7. 生成开机自启 ----------
Step 7 '配置自动启动'
$vbs = Join-Path $InstallDir 'start-hidden.vbs'
$tpl = @'
' LyricLume proxy launcher
' Waits for Spotify, then starts the local proxy once.
Option Explicit
Dim sh, svc, col, i
Set sh = CreateObject("WScript.Shell")
Set svc = GetObject("winmgmts:\\.\root\cimv2")
i = 0
Do While i < 7200
  Set col = svc.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='Spotify.exe'")
  If col.Count > 0 Then Exit Do
  WScript.Sleep 2000
  i = i + 1
Loop
sh.CurrentDirectory = "__DIR__"
sh.Run """__NODE__"" ""__DIR__\server\proxy.mjs""", 0, False
'@
$tpl = $tpl.Replace('__DIR__', $InstallDir).Replace('__NODE__', $node)
[System.IO.File]::WriteAllText($vbs, ($tpl -replace "`r?`n", "`r`n"), [System.Text.Encoding]::ASCII)
Ok "启动器 → $vbs"

$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'LyricLume Proxy.lnk'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = 'C:\Windows\System32\wscript.exe'
$sc.Arguments = '"' + $vbs + '"'
$sc.WorkingDirectory = $InstallDir
$sc.WindowStyle = 7
$sc.Description = 'LyricLume 代理（打开 Spotify 时自动启动）'
$sc.Save()
Ok "开机自启 → $lnk"

# ---------- 8. 应用补丁 ----------
Step 8 '应用 Spicetify 补丁'
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $sp apply 2>&1 | Out-Null
$applyExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($applyExit -ne 0) { throw "spicetify apply 失败（退出码 $applyExit），先运行 spicetify backup apply 再试" }
Ok '补丁已应用'

# ---------- 9. 立刻启动代理 ----------
if (-not $NoProxyStart) {
  Step 9 '启动代理'
  $running = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
  if ($running) {
    Ok '代理已经在运行'
  } else {
    Start-Process wscript.exe -ArgumentList ('"' + $vbs + '"')
    Start-Sleep -Seconds 3
    $running = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
    if ($running) { Ok '代理已启动（127.0.0.1:8787）' } else { Warn '代理启动失败，可稍后手动运行 server\start-hidden.vbs' }
  }
}

Write-Host "`n  安装完成  " -ForegroundColor Black -BackgroundColor DarkGreen
Write-Host @"

  下一步：
    1. 完全退出 Spotify（托盘图标也要退），再重新打开
    2. 播放任意歌曲，点播放器上的「歌词」按钮
    3. 歌词面板右上角会出现「译光」按钮，点它进入全屏歌词

  快捷键：Ctrl + Shift + L

  出问题看这里：
    - 歌词显示「拿不到歌词」→ 代理没启动，运行
      $InstallDir\start-hidden.vbs
    - 改了代码后要重新执行 spicetify apply

"@ -ForegroundColor Gray
