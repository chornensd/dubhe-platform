# 打开 Windows 移动热点（供手机免 USB 联调后端使用）
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File scripts\enable-mobile-hotspot.ps1
$ErrorActionPreference = 'Stop'

try {
    [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime] | Out-Null
    [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime] | Out-Null

    $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
    if (-not $profile) {
        Write-Host '[!] 电脑当前没有可共享的网络（热点需要 Wi-Fi 或以太网联网）' -ForegroundColor Yellow
        exit 1
    }

    $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
    if ($manager.TetheringOperationalState.ToString() -ne 'On') {
        $null = $manager.StartTetheringAsync().GetAwaiter().GetResult()
        Start-Sleep -Seconds 3
    }

    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '192.168.137.*' } |
        Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = '192.168.137.1' }

    Write-Host ''
    Write-Host '==============================================' -ForegroundColor Cyan
    Write-Host ' 移动热点已开启（手机免 USB 联调）' -ForegroundColor Green
    Write-Host ' 热点名称 / 密码：请在「设置 → 网络和 Internet → 移动热点」查看'
    Write-Host " 后端地址：http://$ip`:5180  （App 已保存，无需修改）"
    Write-Host '==============================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '步骤：1) 手机连接 PC 的热点 Wi-Fi   2) 打开「天枢低空」App 即可'
}
catch {
    Write-Host "[!] 打开热点失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '    可手动打开：设置 → 网络和 Internet → 移动热点'
    exit 1
}
