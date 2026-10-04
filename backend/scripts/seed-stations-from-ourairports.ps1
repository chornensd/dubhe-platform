param(
    [string]$BaseUrl = 'http://localhost:5180',
    [Parameter(Mandatory = $true)][string]$Token,
    [string]$MerchantId = '',
    [string]$Country = 'CN',
    [int]$Count = 10,
    [string]$CachePath = ''
)

$ErrorActionPreference = 'Stop'

if (-not $CachePath) {
    $CachePath = Join-Path $PSScriptRoot '..\samples\ourairports-airports.csv'
}

if (-not (Test-Path $CachePath)) {
    Write-Output 'Downloading OurAirports data (public domain, https://ourairports.com/data/)...'
    Invoke-WebRequest 'https://davidmegginson.github.io/ourairports-data/airports.csv' -OutFile $CachePath
}

$headers = @{ Authorization = "Bearer $Token"; 'Device-Type' = 'PC' }

$rows = Import-Csv $CachePath -Encoding UTF8 |
    Where-Object { $_.iso_country -eq $Country -and $_.type -eq 'heliport' } |
    Select-Object -First $Count

if (-not $rows) {
    Write-Output "no heliport records found for country=$Country"
    exit 1
}

$created = 0
$skipped = 0

foreach ($row in $rows) {
    $name = ($row.name ?? '').Trim()
    if (-not $name) {
        continue
    }

    $lat = 0.0
    $lng = 0.0
    [double]::TryParse($row.latitude_deg, [ref]$lat) | Out-Null
    [double]::TryParse($row.longitude_deg, [ref]$lng) | Out-Null
    if ($lat -eq 0 -and $lng -eq 0) {
        continue
    }

    $body = @{
        name         = $name
        type         = 1
        address      = ("$($row.municipality) $name").Trim()
        lat          = $lat
        lng          = $lng
        capacity     = 2
        chargerCount = 0
        remark       = "OurAirports:$($row.ident)"
    }

    if ($MerchantId) {
        $body.merchantId = $MerchantId
    }

    try {
        Invoke-RestMethod "$BaseUrl/api/resource/stations" -Method Post -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json) | Out-Null
        $created++
    }
    catch {
        $skipped++
        $message = try { ($_.ErrorDetails.Message | ConvertFrom-Json).message } catch { $_.Exception.Message }
        Write-Output "skip [$($row.ident)] $name : $message"
    }
}

Write-Output "created $created station(s), skipped $skipped (source: OurAirports, public domain)"
