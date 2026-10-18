# 修复机器级 PATH 中损坏的 dotnet 条目
# 现象: PATH 里有一条 "C:\Program Files\dotnet"" (多一个双引号),
#       会让 Windows 解析 PATH 时丢弃它后面的所有条目, 导致 node 等命令找不到。
#
# 用法: 以管理员身份运行
#   powershell -ExecutionPolicy Bypass -File "D:\wota-toolbox\fix-path-admin.ps1"
#
# 注意: 本文件必须保存为 UTF-8 with BOM, 否则 Windows PowerShell 5.1 会因中文乱码而报错。

$ErrorActionPreference = 'Stop'

# 1) 检查管理员权限
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "错误: 需要管理员权限。" -ForegroundColor Red
    Write-Host "请右键点击开始菜单, 选择 终端(管理员) 或 Windows PowerShell(管理员), 然后运行:" -ForegroundColor Yellow
    Write-Host ('    powershell -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"') -ForegroundColor Yellow
    exit 1
}

# 2) 读取机器级 PATH (不展开环境变量, 保留原样)
$key  = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment'
$item = Get-Item -LiteralPath $key
$name = $item.GetValueNames() | Where-Object { $_ -ieq 'PATH' } | Select-Object -First 1
if (-not $name) {
    Write-Host "没找到 PATH 值。" -ForegroundColor Red
    exit 1
}

$kind = $item.GetValueKind($name)
$old  = $item.GetValue($name, $null, 'DoNotExpandEnvironmentNames')
Write-Host ('值类型: {0}   当前长度: {1}' -f $kind, $old.Length)

# 3) 找出与 dotnet 相关的条目
$bad = @(($old -split ';') | Where-Object { $_ -match 'dotnet' })
if ($bad.Count -eq 0) {
    Write-Host "没有找到 dotnet 条目, PATH 可能已经干净了。" -ForegroundColor Yellow
    exit 0
}
Write-Host "发现条目:"
$bad | ForEach-Object { Write-Host ('    [{0}]' -f $_) }

# 4) 备份原始值
$backup = Join-Path $PSScriptRoot ('path-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
Set-Content -LiteralPath $backup -Value ('OLD=' + $old) -Encoding UTF8
Write-Host ('已备份: {0}' -f $backup)

# 5) 去掉多余的双引号
$parts = $old -split ';'
for ($i = 0; $i -lt $parts.Count; $i++) {
    if ($parts[$i] -match 'dotnet') {
        $parts[$i] = $parts[$i].Replace('"', '').Trim()
    }
}
$new = $parts -join ';'

if ($new -eq $old) {
    Write-Host "无需修改。" -ForegroundColor Yellow
    exit 0
}

Set-ItemProperty -LiteralPath $key -Name $name -Value $new -Type $kind
Write-Host "OK 已修复" -ForegroundColor Green
Write-Host ('现在的 dotnet 条目: ' + (@(($new -split ';') | Where-Object { $_ -match 'dotnet' }) -join ', '))

# 6) 广播环境变量变更, 让新开的窗口立即生效
$sig = 'using System;using System.Runtime.InteropServices;public class EnvBcast{[DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Auto)]public static extern IntPtr SendMessageTimeout(IntPtr hWnd,uint Msg,UIntPtr wParam,string lParam,uint fuFlags,uint uTimeout,out UIntPtr lpdwResult);}'
try {
    Add-Type -TypeDefinition $sig
    $r = [UIntPtr]::Zero
    [void][EnvBcast]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$r)
    Write-Host "已通知系统刷新环境变量。" -ForegroundColor Green
} catch {
    Write-Host ('广播失败(不影响修复, 注销或重启后生效): ' + $_.Exception.Message) -ForegroundColor Yellow
}

Write-Host ''
Write-Host "下一步: 关闭所有终端窗口, 重新打开, 输入 node -v 验证。" -ForegroundColor Cyan