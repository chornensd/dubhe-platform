param(
    [string]$BaseUrl = 'http://localhost:5180',
    [string]$AdminPassword = $env:DUBHE_ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
    throw '缺少管理员口令：请用 -AdminPassword 传入，或先设置环境变量 DUBHE_ADMIN_PASSWORD（见 backend/README.md）。'
}

$script:failures = 0
$runTag = [guid]::NewGuid().ToString('N').Substring(0, 8)
$CustomerPassword = "SmokeC-$runTag-1"
$MerchantPassword = "SmokeM-$runTag-2"

function Write-Check {
    param([string]$Name, [bool]$Ok, [string]$Detail = '')
    if ($Ok) {
        Write-Output "[PASS] $Name $Detail"
    }
    else {
        Write-Output "[FAIL] $Name $Detail"
        $script:failures++
    }
}

for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-RestMethod "$BaseUrl/health" -TimeoutSec 2 | Out-Null
        break
    }
    catch {
        Start-Sleep -Seconds 1
    }
}

$login = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
    -Headers @{ 'Device-Type' = 'PC' } `
    -Body (@{ account = 'admin'; password = $AdminPassword } | ConvertTo-Json)
Write-Check 'admin login (PC)' ($null -ne $login.data.accessToken)
$token = $login.data.accessToken
$auth = @{ Authorization = "Bearer $token" }

$mePc = Invoke-RestMethod "$BaseUrl/api/users/me" -Headers ($auth + @{ 'Device-Type' = 'PC' })
$meMobile = Invoke-RestMethod "$BaseUrl/api/users/me" -Headers ($auth + @{ 'Device-Type' = 'Mobile' })
Write-Check 'PC view returns permissions' ($null -ne $mePc.data.permissions -and $mePc.data.permissions.Count -gt 0)
Write-Check 'Mobile view trims permissions/email' ($null -eq $meMobile.data.permissions -and $null -eq $meMobile.data.email)

$roles = Invoke-RestMethod "$BaseUrl/api/admin/roles" -Headers $auth
Write-Check 'role list' ($roles.data.Count -ge 10)
$permissionGroups = Invoke-RestMethod "$BaseUrl/api/admin/roles/permissions" -Headers $auth
Write-Check 'permission catalog groups' ($permissionGroups.data.Count -ge 7)

$phone = '139{0:D8}' -f (Get-Random -Minimum 10000000 -Maximum 99999999)
$customer = Invoke-RestMethod "$BaseUrl/api/auth/register" -Method Post -ContentType 'application/json' `
    -Body (@{ username = "customer$phone"; phone = $phone; password = $CustomerPassword; displayName = 'Smoke Customer'; userType = 1 } | ConvertTo-Json)
Write-Check 'customer register (Active)' ($customer.data.status -eq 'Active')

$merchantPhone = '138{0:D8}' -f (Get-Random -Minimum 10000000 -Maximum 99999999)
$merchant = Invoke-RestMethod "$BaseUrl/api/auth/register" -Method Post -ContentType 'application/json' `
    -Body (@{ username = "merchant$merchantPhone"; phone = $merchantPhone; password = $MerchantPassword; displayName = 'Smoke Merchant'; userType = 3; companyName = 'Smoke Logistics' } | ConvertTo-Json)
Write-Check 'merchant register (PendingReview)' ($merchant.data.status -eq 'PendingReview')

try {
    Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
        -Body (@{ account = $merchantPhone; password = $MerchantPassword } | ConvertTo-Json) | Out-Null
    Write-Check 'pending merchant login blocked' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'pending merchant login blocked' ($code -eq 'account_pending_review') "code=$code"
}

$users = Invoke-RestMethod "$BaseUrl/api/admin/users?pageNum=1&pageSize=20&keyword=$phone" -Headers $auth
Write-Check 'admin user search' ($users.data.total -ge 1)

Invoke-RestMethod "$BaseUrl/api/admin/users/$($customer.data.id)/freeze" -Method Post -Headers $auth `
    -ContentType 'application/json' -Body (@{ reason = 'smoke test' } | ConvertTo-Json) | Out-Null
try {
    Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
        -Body (@{ account = $customer.data.username; password = $CustomerPassword } | ConvertTo-Json) | Out-Null
    Write-Check 'frozen account login blocked' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'frozen account login blocked' ($code -eq 'account_frozen') "code=$code"
}

Invoke-RestMethod "$BaseUrl/api/admin/users/$($customer.data.id)/unfreeze" -Method Post -Headers $auth | Out-Null
$loginAfter = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
    -Headers @{ 'Device-Type' = 'Mobile' } `
    -Body (@{ account = $customer.data.username; password = $CustomerPassword } | ConvertTo-Json)
Write-Check 'login after unfreeze (Mobile header)' ($null -ne $loginAfter.data.accessToken)

$refresh = Invoke-RestMethod "$BaseUrl/api/auth/refresh" -Method Post -ContentType 'application/json' `
    -Body (@{ refreshToken = $loginAfter.data.refreshToken } | ConvertTo-Json)
Write-Check 'refresh token rotation' ($null -ne $refresh.data.accessToken)

# ---------- M2 order flow ----------

$merchantPhone2 = '137{0:D8}' -f (Get-Random -Minimum 10000000 -Maximum 99999999)
$merchant2 = Invoke-RestMethod "$BaseUrl/api/auth/register" -Method Post -ContentType 'application/json' `
    -Body (@{ username = "merchant$merchantPhone2"; phone = $merchantPhone2; password = $MerchantPassword; displayName = 'Order Merchant'; userType = 3; companyName = 'Order Logistics' } | ConvertTo-Json)
Invoke-RestMethod "$BaseUrl/api/admin/users/$($merchant2.data.id)/approve" -Method Post -Headers $auth | Out-Null

$merchantLogin = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
    -Headers @{ 'Device-Type' = 'PC' } `
    -Body (@{ account = $merchantPhone2; password = $MerchantPassword } | ConvertTo-Json)
Write-Check 'merchant approved and login' ($null -ne $merchantLogin.data.accessToken)
$merchantAuth = @{ Authorization = "Bearer $($merchantLogin.data.accessToken)" }

$drone = Invoke-RestMethod "$BaseUrl/api/resource/drones" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ serialNo = "DRN-$merchantPhone2"; model = 'D-100'; maxPayloadKg = 5; enduranceMinutes = 90; batteryPercent = 95 } | ConvertTo-Json)
Write-Check 'drone registered (Idle)' ($drone.data.status -eq 'Idle')

$area = Invoke-RestMethod "$BaseUrl/api/resource/service-areas" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ name = 'Main Area'; centerLat = 30.0; centerLng = 120.0; radiusKm = 10 } | ConvertTo-Json)
Write-Check 'service area created' ($area.data.radiusKm -eq 10)

$custPhone2 = '136{0:D8}' -f (Get-Random -Minimum 10000000 -Maximum 99999999)
$null = Invoke-RestMethod "$BaseUrl/api/auth/register" -Method Post -ContentType 'application/json' `
    -Body (@{ username = "cust$custPhone2"; phone = $custPhone2; password = $CustomerPassword; displayName = 'Order Customer'; userType = 1 } | ConvertTo-Json)
$custLogin = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
    -Headers @{ 'Device-Type' = 'Mobile' } `
    -Body (@{ account = $custPhone2; password = $CustomerPassword } | ConvertTo-Json)
$custAuth = @{ Authorization = "Bearer $($custLogin.data.accessToken)" }
Write-Check 'order customer login' ($null -ne $custLogin.data.accessToken)

$orderBody = @{
    merchantId       = $merchant2.data.id
    senderName       = 'Customer'
    senderPhone      = $custPhone2
    senderAddress    = 'Sender Rd 1'
    senderLat        = 30.0
    senderLng        = 120.0
    receiverName     = 'Receiver'
    receiverPhone    = '13900002222'
    receiverAddress  = 'Receiver Rd 2'
    receiverLat      = 30.02
    receiverLng      = 120.02
    itemCategory     = 'documents'
    itemName         = 'Contract'
    weightKg         = 2
    volumeM3         = 0.01
    quantity         = 1
    isUrgent         = $true
    couponAmount     = 0
}

$estimate = Invoke-RestMethod "$BaseUrl/api/orders/estimate" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($orderBody | ConvertTo-Json)
Write-Check 'order estimate with service area check' ($estimate.data.serviceAreaChecked -and $estimate.data.fee.totalAmount -gt 0)

$order = Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($orderBody | ConvertTo-Json)
Write-Check 'order created (PendingAccept)' ($order.data.status -eq 'PendingAccept' -and $order.data.orderNo.StartsWith('DBH'))

$outsideBody = $orderBody.Clone()
$outsideBody.receiverLat = 31.5
$outsideBody.receiverLng = 121.5
try {
    Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($outsideBody | ConvertTo-Json) | Out-Null
    Write-Check 'out-of-area order rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'out-of-area order rejected' ($code -eq 'out_of_service_area') "code=$code"
}

$prohibitedBody = $orderBody.Clone()
$prohibitedBody.itemCategory = 'flammable'
try {
    Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($prohibitedBody | ConvertTo-Json) | Out-Null
    Write-Check 'prohibited item rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'prohibited item rejected' ($code -eq 'prohibited_item') "code=$code"
}

$accepted = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/accept" -Method Post -Headers $merchantAuth
Write-Check 'merchant accepts order' ($accepted.data.status -eq 'PendingDispatch')

$dispatch = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/dispatch" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; waypoints = @(@{ lat = 30.0; lng = 120.0 }, @{ lat = 30.02; lng = 120.02 }) } | ConvertTo-Json -Depth 5)
Write-Check 'order dispatched with drone' ($dispatch.data.droneId -eq $drone.data.id -and $dispatch.data.plannedRoute.Count -eq 2)

$started = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/start" -Method Post -Headers $merchantAuth
Write-Check 'flight started (InFlight)' ($started.data.status -eq 'InFlight')

$droneInFlight = Invoke-RestMethod "$BaseUrl/api/resource/drones?status=InFlight" -Headers $merchantAuth
Write-Check 'drone marked InFlight' ($droneInFlight.data.total -eq 1)

try {
    Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/review" -Method Post -Headers $custAuth -ContentType 'application/json' `
        -Body (@{ rating = 5; comment = 'great' } | ConvertTo-Json) | Out-Null
    Write-Check 'review blocked before delivery' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'review blocked before delivery' ($code -eq 'order_state_invalid') "code=$code"
}

$completed = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/complete" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ remark = 'delivered' } | ConvertTo-Json)
Write-Check 'order delivered' ($completed.data.status -eq 'Delivered')

$droneIdle = Invoke-RestMethod "$BaseUrl/api/resource/drones?status=Idle" -Headers $merchantAuth
Write-Check 'drone back to Idle' ($droneIdle.data.total -eq 1)

$reviewed = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/review" -Method Post -Headers $custAuth -ContentType 'application/json' `
    -Body (@{ rating = 5; comment = 'great' } | ConvertTo-Json)
Write-Check 'order reviewed' ($reviewed.data.rating -eq 5)

$custOrders = Invoke-RestMethod "$BaseUrl/api/orders?pageNum=1&pageSize=10" -Headers $custAuth
Write-Check 'customer sees own orders' ($custOrders.data.total -ge 1)

$merchantOrders = Invoke-RestMethod "$BaseUrl/api/orders?pageNum=1&pageSize=10" -Headers $merchantAuth
Write-Check 'merchant sees own orders' ($merchantOrders.data.total -ge 1)

$order2 = Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($orderBody | ConvertTo-Json)
$rejected = Invoke-RestMethod "$BaseUrl/api/orders/$($order2.data.id)/reject" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ reason = 'capacity full' } | ConvertTo-Json)
Write-Check 'merchant rejects order' ($rejected.data.status -eq 'Cancelled')

# ---------- M2 batch import & auto accept ----------

$samplesDir = Join-Path $PSScriptRoot '..\samples'
New-Item -ItemType Directory -Force -Path $samplesDir | Out-Null

$templatePath = Join-Path $samplesDir 'order-import-template.xlsx'
Invoke-WebRequest "$BaseUrl/api/orders/import/template" -Headers $custAuth -OutFile $templatePath
Write-Check 'import template downloaded' ((Get-Item $templatePath).Length -gt 1000)

$samplePath = Join-Path $samplesDir 'order-import-sample.xlsx'
Write-Check 'sample file exists' (Test-Path $samplePath)

$import = Invoke-RestMethod "$BaseUrl/api/orders/import?merchantId=$($merchant2.data.id)" -Method Post -Headers $custAuth -Form @{ file = Get-Item $samplePath }
Write-Check 'batch import counts (20/15/5)' ($import.data.total -eq 20 -and $import.data.succeeded -eq 15 -and $import.data.failed -eq 5)
$importErrors = @($import.data.errors)
Write-Check 'import error rows returned' ($importErrors.Count -eq 5 -and ($importErrors | Where-Object { $_.message -like '*超出商家服务区域*' }).Count -ge 1 -and ($importErrors | Where-Object { $_.message -like '*禁运品*' }).Count -ge 1)

$ruleBefore = Invoke-RestMethod "$BaseUrl/api/orders/auto-accept" -Headers $merchantAuth
Write-Check 'auto-accept disabled by default' ($ruleBefore.data.enabled -eq $false)

$rule = Invoke-RestMethod "$BaseUrl/api/orders/auto-accept" -Method Put -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ enabled = $true; maxWeightKg = 3; maxDistanceKm = 20 } | ConvertTo-Json)
Write-Check 'auto-accept rule updated' ($rule.data.enabled -and $rule.data.maxWeightKg -eq 3)

$autoBody = $orderBody.Clone()
$autoBody.weightKg = 2
$autoOrder = Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($autoBody | ConvertTo-Json)
Write-Check 'order auto-accepted on rule match' ($autoOrder.data.status -eq 'PendingDispatch')

$heavyBody = $orderBody.Clone()
$heavyBody.weightKg = 4
$heavyOrder = Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($heavyBody | ConvertTo-Json)
Write-Check 'heavy order stays PendingAccept' ($heavyOrder.data.status -eq 'PendingAccept')

# ---------- M3 stations ----------

$station = Invoke-RestMethod "$BaseUrl/api/resource/stations" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ name = "Hangzhou Pad $merchantPhone2"; type = 1; address = '测试路 1 号'; lat = 30.01; lng = 120.01; capacity = 2; chargerCount = 4 } | ConvertTo-Json)
Write-Check 'station created' ($station.data.status -eq 'Idle' -and $station.data.capacity -eq 2)

$stations = Invoke-RestMethod "$BaseUrl/api/resource/stations?pageNum=1&pageSize=10" -Headers $merchantAuth
Write-Check 'station list' ($stations.data.total -ge 1)

$slotStart = (Get-Date).ToUniversalTime().AddHours(3)
$slotEnd = $slotStart.AddHours(1)
$reservationBody = @{ startAt = $slotStart.ToString('o'); endAt = $slotEnd.ToString('o'); purpose = 1; remark = 'smoke' } | ConvertTo-Json

$reservation1 = Invoke-RestMethod "$BaseUrl/api/resource/stations/$($station.data.id)/reservations" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $reservationBody
$reservation2 = Invoke-RestMethod "$BaseUrl/api/resource/stations/$($station.data.id)/reservations" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $reservationBody
Write-Check 'station capacity allows two reservations' ($reservation1.data.status -eq 'Reserved' -and $reservation2.data.status -eq 'Reserved')

try {
    Invoke-RestMethod "$BaseUrl/api/resource/stations/$($station.data.id)/reservations" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $reservationBody | Out-Null
    Write-Check 'over-capacity reservation rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'over-capacity reservation rejected' ($code -eq 'resource_conflict') "code=$code"
}

$cancelReservation = Invoke-RestMethod "$BaseUrl/api/resource/reservations/$($reservation1.data.id)/cancel" -Method Post -Headers $merchantAuth
Write-Check 'reservation cancelled' ($cancelReservation.data.status -eq 'Cancelled')

$reservation3 = Invoke-RestMethod "$BaseUrl/api/resource/stations/$($station.data.id)/reservations" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $reservationBody
Write-Check 'slot freed after cancellation' ($reservation3.data.status -eq 'Reserved')

$reservationList = Invoke-RestMethod "$BaseUrl/api/resource/stations/$($station.data.id)/reservations" -Headers $merchantAuth
Write-Check 'reservation list' ($reservationList.data.Count -eq 3)

$droneIdleAfter = Invoke-RestMethod "$BaseUrl/api/resource/drones?status=Idle" -Headers $merchantAuth
Write-Check 'drone cumulative flight minutes tracked' ($droneIdleAfter.data.items[0].cumulativeFlightMinutes -gt 0)

# ---------- M3 crew / maintenance / faults / reminders ----------

$crew = Invoke-RestMethod "$BaseUrl/api/resource/crew" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ name = 'Pilot Wang'; gender = '男'; phone = '13500000001'; role = 1; region = '杭州' } | ConvertTo-Json)
Write-Check 'crew created' ($crew.data.role -eq 'Pilot' -and $crew.data.status -eq 'Active')

$expiresAt = (Get-Date).ToUniversalTime().AddDays(10).ToString('o')
$qualification = Invoke-RestMethod "$BaseUrl/api/resource/crew/$($crew.data.id)/qualifications" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ type = '驾驶证'; number = "PILOT-$merchantPhone2"; issuedAt = (Get-Date).ToUniversalTime().AddYears(-1).ToString('o'); expiresAt = $expiresAt } | ConvertTo-Json)
Write-Check 'qualification added' ($qualification.data.isExpired -eq $false)

$crewDetail = Invoke-RestMethod "$BaseUrl/api/resource/crew/$($crew.data.id)" -Headers $merchantAuth
Write-Check 'crew detail with qualifications' ($crewDetail.data.qualificationCount -eq 1 -and $crewDetail.data.qualifications.Count -eq 1)

$shiftStart = (Get-Date).ToUniversalTime().AddDays(1).AddHours(1)
$shiftBody = @{ startAt = $shiftStart.ToString('o'); endAt = $shiftStart.AddHours(8).ToString('o'); area = '杭州' } | ConvertTo-Json
$schedule = Invoke-RestMethod "$BaseUrl/api/resource/crew/$($crew.data.id)/schedules" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $shiftBody
Write-Check 'schedule created' ($schedule.data.area -eq '杭州')
try {
    Invoke-RestMethod "$BaseUrl/api/resource/crew/$($crew.data.id)/schedules" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $shiftBody | Out-Null
    Write-Check 'conflicting schedule rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'conflicting schedule rejected' ($code -eq 'resource_conflict') "code=$code"
}

$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$attendance = Invoke-RestMethod "$BaseUrl/api/resource/crew/$($crew.data.id)/attendances" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ date = $today; status = 1; remark = '正常' } | ConvertTo-Json)
Write-Check 'attendance recorded' ($attendance.data.status -eq 'Normal')
$attendanceUpdated = Invoke-RestMethod "$BaseUrl/api/resource/crew/$($crew.data.id)/attendances" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ date = $today; status = 2; remark = '迟到' } | ConvertTo-Json)
Write-Check 'attendance upserted' ($attendanceUpdated.data.status -eq 'Late')

$plan = Invoke-RestMethod "$BaseUrl/api/resource/maintenance/plans" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; intervalFlightMinutes = 1; enabled = $true; remark = 'smoke plan' } | ConvertTo-Json)
Write-Check 'maintenance plan created' ($plan.data.nextDueFlightMinutes -ge 1)

# fly one order to accumulate minutes, which makes the 1-minute plan overdue
$heavyFlightBody = $orderBody.Clone()
$heavyFlightBody.weightKg = 4
$flightOrder = Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($heavyFlightBody | ConvertTo-Json)
Invoke-RestMethod "$BaseUrl/api/orders/$($flightOrder.data.id)/accept" -Method Post -Headers $merchantAuth | Out-Null
Invoke-RestMethod "$BaseUrl/api/orders/$($flightOrder.data.id)/dispatch" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ droneId = $drone.data.id } | ConvertTo-Json) | Out-Null
Invoke-RestMethod "$BaseUrl/api/orders/$($flightOrder.data.id)/start" -Method Post -Headers $merchantAuth | Out-Null
Invoke-RestMethod "$BaseUrl/api/orders/$($flightOrder.data.id)/complete" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ remark = 'done' } | ConvertTo-Json) | Out-Null

$blockedOrder = Invoke-RestMethod "$BaseUrl/api/orders" -Method Post -Headers $custAuth -ContentType 'application/json' -Body ($heavyFlightBody | ConvertTo-Json)
Invoke-RestMethod "$BaseUrl/api/orders/$($blockedOrder.data.id)/accept" -Method Post -Headers $merchantAuth | Out-Null
try {
    Invoke-RestMethod "$BaseUrl/api/orders/$($blockedOrder.data.id)/dispatch" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ droneId = $drone.data.id } | ConvertTo-Json) | Out-Null
    Write-Check 'dispatch blocked by overdue maintenance' $false
}
catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Check 'dispatch blocked by overdue maintenance' ($errorBody.code -eq 'drone_unavailable' -and $errorBody.message -like '*超期未维保*') "code=$($errorBody.code)"
}

$maintenanceRecord = Invoke-RestMethod "$BaseUrl/api/resource/maintenance/records" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; planId = $plan.data.id; crewMemberId = $crew.data.id; type = '定期维保'; content = '例行检查并更换桨叶' } | ConvertTo-Json)
Write-Check 'maintenance record created' ($maintenanceRecord.data.type -eq '定期维保')

$dispatchAfterMaintenance = Invoke-RestMethod "$BaseUrl/api/orders/$($blockedOrder.data.id)/dispatch" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ droneId = $drone.data.id } | ConvertTo-Json)
Write-Check 'dispatch allowed after maintenance' ($dispatchAfterMaintenance.data.droneId -eq $drone.data.id)

$fault = Invoke-RestMethod "$BaseUrl/api/resource/faults" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; faultType = '电机异常'; description = '起飞时异响'; photoUrls = @('https://example.com/fault.jpg'); lat = 30.01; lng = 120.01 } | ConvertTo-Json)
Write-Check 'fault reported' ($fault.data.status -eq 'Reported' -and $fault.data.photoUrls.Count -eq 1)

$handled = Invoke-RestMethod "$BaseUrl/api/resource/faults/$($fault.data.id)/handle" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ handlerCrewId = $crew.data.id } | ConvertTo-Json)
Write-Check 'fault assigned to handler' ($handled.data.status -eq 'Handling' -and $handled.data.handlerCrewId -eq $crew.data.id)

$resolved = Invoke-RestMethod "$BaseUrl/api/resource/faults/$($fault.data.id)/resolve" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ resolution = '更换电机并测试通过' } | ConvertTo-Json)
Write-Check 'fault resolved' ($resolved.data.status -eq 'Resolved')

$reminderRun = Invoke-RestMethod "$BaseUrl/api/admin/system/reminders/run" -Method Post -Headers $auth
Write-Check 'reminder scan created qualification reminder' ($reminderRun.data.qualificationReminders -ge 1)

$notifications = Invoke-RestMethod "$BaseUrl/api/notifications?unreadOnly=true" -Headers $merchantAuth
Write-Check 'merchant received qualification reminder' (($notifications.data.items | Where-Object { $_.type -eq 'QualificationExpiry' }).Count -ge 1)

$readAll = Invoke-RestMethod "$BaseUrl/api/notifications/read-all" -Method Post -Headers $merchantAuth
Write-Check 'notifications marked as read' ($readAll.data.marked -ge 1)

# ---------- M2 payment / settlement / invoice ----------

$payment = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/pay" -Method Post -Headers $custAuth -ContentType 'application/json' -Body (@{ method = 2; simulateFailure = $false } | ConvertTo-Json)
Write-Check 'order paid (Alipay mock)' ($payment.data.status -eq 'Succeeded' -and -not [string]::IsNullOrWhiteSpace($payment.data.transactionNo))

try {
    Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/pay" -Method Post -Headers $custAuth -ContentType 'application/json' -Body (@{ method = 1; simulateFailure = $false } | ConvertTo-Json) | Out-Null
    Write-Check 'duplicate payment rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'duplicate payment rejected' ($code -eq 'resource_conflict') "code=$code"
}

$failedPayment = Invoke-RestMethod "$BaseUrl/api/orders/$($blockedOrder.data.id)/pay" -Method Post -Headers $custAuth -ContentType 'application/json' -Body (@{ method = 1; simulateFailure = $true; failureReason = '余额不足' } | ConvertTo-Json)
Write-Check 'failed payment recorded' ($failedPayment.data.status -eq 'Failed' -and $failedPayment.data.failureReason -eq '余额不足')

$payments = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/payments" -Headers $custAuth
Write-Check 'payment records listed' ($payments.data.Count -ge 1)

$periodStart = (Get-Date).ToUniversalTime().Date
$periodEnd = $periodStart.AddDays(1)
$settlementBody = @{ periodStart = $periodStart.ToString('o'); periodEnd = $periodEnd.ToString('o') } | ConvertTo-Json
$settlement = Invoke-RestMethod "$BaseUrl/api/settlements/generate" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $settlementBody
Write-Check 'settlement generated' ($settlement.data.orderCount -ge 2 -and $settlement.data.netAmount -gt 0 -and $settlement.data.status -eq 'Draft')

Write-Check 'settlement reconciliation tracked' ($settlement.data.reconciliation.paidCount -ge 1 -and $settlement.data.reconciliation.unpaidCount -ge 1)

try {
    Invoke-RestMethod "$BaseUrl/api/settlements/generate" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body $settlementBody | Out-Null
    Write-Check 'duplicate settlement rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'duplicate settlement rejected' ($code -eq 'validation_error') "code=$code"
}

$confirmed = Invoke-RestMethod "$BaseUrl/api/settlements/$($settlement.data.id)/confirm" -Method Post -Headers $merchantAuth
Write-Check 'settlement confirmed by merchant' ($confirmed.data.status -eq 'Confirmed')

$settled = Invoke-RestMethod "$BaseUrl/api/settlements/$($settlement.data.id)/settle" -Method Post -Headers $auth
Write-Check 'settlement settled by admin' ($settled.data.status -eq 'Settled')

$exportPath = Join-Path $samplesDir 'settlement-export-smoke.xlsx'
Invoke-WebRequest "$BaseUrl/api/settlements/$($settlement.data.id)/export" -Headers $merchantAuth -OutFile $exportPath
Write-Check 'settlement excel exported' ((Get-Item $exportPath).Length -gt 2000)

$invoice = Invoke-RestMethod "$BaseUrl/api/invoices" -Method Post -Headers $custAuth -ContentType 'application/json' `
    -Body (@{ orderIds = @($order.data.id); title = '测试科技有限公司'; taxNo = '91330100MA2XXXXX0A'; remark = '差旅费用' } | ConvertTo-Json)
Write-Check 'invoice applied' ($invoice.data.status -eq 'Submitted' -and $invoice.data.amount -gt 0)

try {
    Invoke-RestMethod "$BaseUrl/api/invoices" -Method Post -Headers $custAuth -ContentType 'application/json' `
        -Body (@{ orderIds = @($blockedOrder.data.id); title = '测试科技有限公司'; taxNo = '91330100MA2XXXXX0A' } | ConvertTo-Json) | Out-Null
    Write-Check 'invoice for unpaid order rejected' $false
}
catch {
    $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code
    Write-Check 'invoice for unpaid order rejected' ($code -eq 'validation_error') "code=$code"
}

$issued = Invoke-RestMethod "$BaseUrl/api/invoices/$($invoice.data.id)/issue" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ invoiceNo = 'INV-2026-0001'; fileUrl = 'https://example.com/invoice.pdf' } | ConvertTo-Json)
Write-Check 'invoice issued by admin' ($issued.data.status -eq 'Issued' -and $issued.data.invoiceNo -eq 'INV-2026-0001')

$refund = Invoke-RestMethod "$BaseUrl/api/orders/$($order.data.id)/refund" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body (@{ reason = '客户申请退款' } | ConvertTo-Json)
Write-Check 'order refunded' ($refund.data.status -eq 'Refunded')

# ---------- M4 airspace ----------

$noFlyLat = 30.5 + (Get-Random -Minimum 0 -Maximum 900) / 1000.0
$noFlyLng = 121.0 + (Get-Random -Minimum 0 -Maximum 900) / 1000.0
$noFly = Invoke-RestMethod "$BaseUrl/api/airspace/zones" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ name = "杭州测试禁飞区-$merchantPhone2"; type = 1; centerLat = $noFlyLat; centerLng = $noFlyLng; radiusKm = 1.0; minAltitudeM = 0; maxAltitudeM = 500; reason = 'smoke' } | ConvertTo-Json)
Write-Check 'no-fly zone created' ($noFly.data.type -eq 'NoFly' -and $noFly.data.source -eq 'Manual')

$fence = Invoke-RestMethod "$BaseUrl/api/airspace/fences" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ name = "商家限飞围栏"; type = 2; centerLat = 30.03; centerLng = 120.03; radiusKm = 0.5 } | ConvertTo-Json)
Write-Check 'merchant fence created' ($fence.data.source -eq 'MerchantFence' -and $fence.data.merchantId -eq $merchant2.data.id)

$zones = Invoke-RestMethod "$BaseUrl/api/airspace/zones?pageSize=100" -Headers $merchantAuth
Write-Check 'zone list includes platform zone and fence' ($zones.data.total -ge 2)

$planStart = (Get-Date).ToUniversalTime().AddMinutes(30)
$planEnd = $planStart.AddHours(1)
$planBody = @{
    droneId      = $drone.data.id
    pilotCrewId  = $crew.data.id
    purpose      = '配送任务'
    startAt      = $planStart.ToString('o')
    endAt        = $planEnd.ToString('o')
    maxAltitudeM = 120
    waypoints    = @(@{ lat = 30.00; lng = 120.00 }, @{ lat = 30.01; lng = 120.01 })
}

$cleanPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body ($planBody | ConvertTo-Json -Depth 5)
Write-Check 'flight plan draft created' ($cleanPlan.data.status -eq 'Draft')

$submittedPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($cleanPlan.data.id)/submit" -Method Post -Headers $merchantAuth
Write-Check 'flight plan submitted' ($submittedPlan.data.status -eq 'Submitted')

$conflictBody = $planBody.Clone()
$conflictBody.waypoints = @(
    @{ lat = $noFlyLat - 0.01; lng = $noFlyLng - 0.01 },
    @{ lat = $noFlyLat + 0.01; lng = $noFlyLng + 0.01 })
$conflictPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body ($conflictBody | ConvertTo-Json -Depth 5)
try {
    Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($conflictPlan.data.id)/submit" -Method Post -Headers $merchantAuth | Out-Null
    Write-Check 'no-fly route blocked on submit' $false
}
catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Check 'no-fly route blocked on submit' ($errorBody.code -eq 'airspace_conflict' -and $errorBody.message -like '*禁飞区*') "code=$($errorBody.code)"
}

$droneConflictBody = $planBody.Clone()
$droneConflictBody.waypoints = @(@{ lat = 30.00; lng = 120.01 }, @{ lat = 30.01; lng = 120.02 })
$droneConflictPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body ($droneConflictBody | ConvertTo-Json -Depth 5)
try {
    Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($droneConflictPlan.data.id)/submit" -Method Post -Headers $merchantAuth | Out-Null
    Write-Check 'drone time conflict blocked' $false
}
catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Check 'drone time conflict blocked' ($errorBody.code -eq 'airspace_conflict') "code=$($errorBody.code)"
}

$suggestion = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($cleanPlan.data.id)/approval-suggestion" -Headers $auth
Write-Check 'approval suggestion generated' ($suggestion.data.suggestion -eq 'Approve' -and $suggestion.data.reasons.Count -ge 1)

$approvedPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($cleanPlan.data.id)/approve" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ comment = '同意' } | ConvertTo-Json)
Write-Check 'flight plan approved with plan no' ($approvedPlan.data.status -eq 'Approved' -and $approvedPlan.data.planNo.StartsWith('FP'))

$rejectStart = $planStart.AddHours(3)
$rejectBody = $planBody.Clone()
$rejectBody.startAt = $rejectStart.ToString('o')
$rejectBody.endAt = $rejectStart.AddHours(1).ToString('o')
$rejectPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans" -Method Post -Headers $merchantAuth -ContentType 'application/json' -Body ($rejectBody | ConvertTo-Json -Depth 5)
Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($rejectPlan.data.id)/submit" -Method Post -Headers $merchantAuth | Out-Null
$rejectedPlan = Invoke-RestMethod "$BaseUrl/api/airspace/flight-plans/$($rejectPlan.data.id)/reject" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ reason = '时段冲突，请调整' } | ConvertTo-Json)
Write-Check 'flight plan rejected' ($rejectedPlan.data.status -eq 'Rejected')

$intrusion = Invoke-RestMethod "$BaseUrl/api/airspace/monitoring/positions" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; lat = $noFlyLat; lng = $noFlyLng; altitudeM = 100 } | ConvertTo-Json)
Write-Check 'no-fly intrusion detected' (($intrusion.data.detectedViolations | Where-Object { $_.type -eq 'NoFlyIntrusion' }).Count -eq 1)

$intrusionDup = Invoke-RestMethod "$BaseUrl/api/airspace/monitoring/positions" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; lat = $noFlyLat; lng = $noFlyLng; altitudeM = 100 } | ConvertTo-Json)
Write-Check 'duplicate intrusion deduped' ($intrusionDup.data.detectedViolations.Count -eq 0)

$deviation = Invoke-RestMethod "$BaseUrl/api/airspace/monitoring/positions" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ droneId = $drone.data.id; lat = 30.00; lng = 120.20; altitudeM = 100; reportedAt = $planStart.AddMinutes(10).ToString('o') } | ConvertTo-Json)
Write-Check 'route deviation detected' ((($deviation.data.detectedViolations | Where-Object { $_.type -eq 'RouteDeviation' }).Count -eq 1) -and $deviation.data.distanceToRouteKm -gt 1)

$violations = Invoke-RestMethod "$BaseUrl/api/airspace/violations?pageSize=20" -Headers $merchantAuth
Write-Check 'violations listed for merchant' ($violations.data.total -ge 1 -and ($violations.data.items | Where-Object { $_.type -eq 'NoFlyIntrusion' }).Count -ge 1)

$noFlyViolation = $violations.data.items | Where-Object { $_.type -eq 'NoFlyIntrusion' } | Select-Object -First 1
$handledViolation = Invoke-RestMethod "$BaseUrl/api/airspace/violations/$($noFlyViolation.id)/handle" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ remark = '已联系商家整改' } | ConvertTo-Json)
Write-Check 'violation handling' ($handledViolation.data.status -eq 'Handling')

$penalty = Invoke-RestMethod "$BaseUrl/api/airspace/violations/$($noFlyViolation.id)/penalties" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ type = 1; reason = '首次违规，予以警告' } | ConvertTo-Json)
Write-Check 'penalty issued' ($penalty.data.type -eq 'Warning')

$violationsAfter = Invoke-RestMethod "$BaseUrl/api/airspace/violations?pageSize=20" -Headers $merchantAuth
$penalizedViolation = $violationsAfter.data.items | Where-Object { $_.id -eq $noFlyViolation.id } | Select-Object -First 1
Write-Check 'penalty attached to violation' ($penalizedViolation.penalties.Count -ge 1)

$mockZone = Invoke-RestMethod "$BaseUrl/api/airspace/zones/mock-sync" -Method Post -Headers $auth
Write-Check 'mock ATS sync created temporary zone' ($mockZone.data.type -eq 'TemporaryControl' -and $mockZone.data.source -eq 'MockAts')

$violationNotifications = Invoke-RestMethod "$BaseUrl/api/notifications?pageSize=50" -Headers $merchantAuth
Write-Check 'merchant notified about violation' (($violationNotifications.data.items | Where-Object { $_.type -eq 'Violation' }).Count -ge 1)

# ---------- 选做：智能体（骨架） ----------

$agentInfo = Invoke-RestMethod "$BaseUrl/api/agent/info" -Headers $auth
Write-Check 'agent stub info' ($agentInfo.data.implementation -eq 'stub' -and $agentInfo.data.supportedTaskTypes.Count -eq 5)

$knowledgeDoc = Invoke-RestMethod "$BaseUrl/api/agent/knowledge-docs" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ title = '订单状态机规范'; category = '功能实现'; tags = '订单,状态机'; content = '订单状态流转说明文档'; version = 'v1'; isPublished = $true } | ConvertTo-Json)
Write-Check 'knowledge doc created' ($knowledgeDoc.data.isPublished -eq $true)

$docSearch = Invoke-RestMethod "$BaseUrl/api/agent/knowledge-docs?keyword=状态机" -Headers $auth
Write-Check 'knowledge doc searchable' ($docSearch.data.total -ge 1)

$agentTask = Invoke-RestMethod "$BaseUrl/api/agent/tasks" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ type = 1; title = '解析需求文档'; input = '请解析订单模块需求' } | ConvertTo-Json)
Write-Check 'agent task stub executed' ($agentTask.data.status -eq 'Succeeded' -and $agentTask.data.output -like '*骨架实现*')

$protocol = Invoke-RestMethod "$BaseUrl/api/agent/protocols" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ name = "开发协作协定-$merchantPhone2"; version = 'v1'; description = '团队约定'; content = '{"rule":"先契约后实现"}' } | ConvertTo-Json)
Write-Check 'agent protocol persisted' ($protocol.data.name -like '开发协作协定*')

$protocols = Invoke-RestMethod "$BaseUrl/api/agent/protocols" -Headers $auth
Write-Check 'agent protocols listed' ($protocols.data.Count -ge 1)

# ---------- M5 reports ----------

$adminDash = Invoke-RestMethod "$BaseUrl/api/reports/dashboard/admin" -Headers $auth
Write-Check 'admin dashboard aggregates' ($adminDash.data.totalOrders -ge 1 -and $adminDash.data.orderTrend.Count -eq 7 -and $adminDash.data.violationTrend.Count -eq 7)

$merchantDash = Invoke-RestMethod "$BaseUrl/api/reports/dashboard/merchant" -Headers $merchantAuth
Write-Check 'merchant dashboard' ($merchantDash.data.completedOrders -ge 1 -and $merchantDash.data.completionRate -gt 0 -and $merchantDash.data.deliveryDurationDistribution.Count -eq 5)

$atcDash = Invoke-RestMethod "$BaseUrl/api/reports/dashboard/air-traffic" -Headers $auth
Write-Check 'air traffic dashboard' ($atcDash.data.totalPlans -ge 1 -and $atcDash.data.approvalRate -gt 0 -and $atcDash.data.flightDensity.Count -ge 1)

$reportFields = Invoke-RestMethod "$BaseUrl/api/reports/fields?businessType=order" -Headers $merchantAuth
Write-Check 'report field catalog' (($reportFields.data | Where-Object { $_.key -eq 'totalAmount' }).Count -eq 1)

$reportRun = Invoke-RestMethod "$BaseUrl/api/reports/run" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ businessType = 'order'; fields = @('orderNo', 'status', 'totalAmount', 'paymentStatus'); filters = @{} } | ConvertTo-Json)
Write-Check 'report run returns rows' ($reportRun.data.rows.Count -ge 1 -and $reportRun.data.columns.Count -eq 4)

$reportExportPath = Join-Path $samplesDir 'report-export-smoke.xlsx'
Invoke-WebRequest "$BaseUrl/api/reports/export" -Method Post -Headers $merchantAuth -ContentType 'application/json' -OutFile $reportExportPath `
    -Body (@{ businessType = 'order'; fields = @('orderNo', 'totalAmount'); filters = @{} } | ConvertTo-Json)
Write-Check 'report excel exported' ((Get-Item $reportExportPath).Length -gt 1000)

$template = Invoke-RestMethod "$BaseUrl/api/reports/templates" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ name = "订单日报-$merchantPhone2"; businessType = 'order'; fields = @('orderNo', 'totalAmount'); filters = @{}; isShared = $false } | ConvertTo-Json)
Write-Check 'report template created' ($template.data.fields.Count -eq 2)

$templates = Invoke-RestMethod "$BaseUrl/api/reports/templates" -Headers $merchantAuth
Write-Check 'report template listed' ($templates.data.total -ge 1)

$share = Invoke-RestMethod "$BaseUrl/api/reports/shares" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ recipientUserId = $login.data.user.id; title = '订单报表分享'; businessType = 'order'; fields = @('orderNo', 'totalAmount'); filters = @{}; expireDays = 3; canExport = $true } | ConvertTo-Json)
Write-Check 'report share created' ($share.data.isRevoked -eq $false)

$receivedShares = Invoke-RestMethod "$BaseUrl/api/reports/shares/received" -Headers $auth
Write-Check 'shared report received' ($receivedShares.data.Count -ge 1)

$sharedData = Invoke-RestMethod "$BaseUrl/api/reports/shares/$($share.data.id)/access" -Method Post -Headers $auth
Write-Check 'shared report accessed' ($sharedData.data.rows.Count -ge 1)

$revokedShare = Invoke-RestMethod "$BaseUrl/api/reports/shares/$($share.data.id)/revoke" -Method Post -Headers $merchantAuth
Write-Check 'report share revoked' ($revokedShare.data.isRevoked -eq $true)

# ---------- M6 emergency / tickets / help ----------

$alert = Invoke-RestMethod "$BaseUrl/api/support/emergency-alerts" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ title = '飞行器失联'; content = '3 号飞行器失去联系'; level = 3 } | ConvertTo-Json)
Write-Check 'emergency alert reported' ($alert.data.status -eq 'Open' -and $alert.data.level -eq 'Critical')

$dispatchedAlert = Invoke-RestMethod "$BaseUrl/api/support/emergency-alerts/$($alert.data.id)/dispatch" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ handlers = @($login.data.user.id); plan = '联系机长并启动搜寻'; deadlineAt = (Get-Date).ToUniversalTime().AddHours(2).ToString('o') } | ConvertTo-Json)
Write-Check 'emergency dispatched' ($dispatchedAlert.data.status -eq 'Handling' -and $dispatchedAlert.data.handlers.Count -eq 1)

$progressAlert = Invoke-RestMethod "$BaseUrl/api/support/emergency-alerts/$($alert.data.id)/progress" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ note = '已联系机长，定位到飞行器'; attachments = @('https://example.com/loc.jpg'); status = 3 } | ConvertTo-Json)
Write-Check 'emergency progress with status' ($progressAlert.data.status -eq 'Resolved')

$closedAlert = Invoke-RestMethod "$BaseUrl/api/support/emergency-alerts/$($alert.data.id)/close" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ result = '设备已回收，无人员伤亡' } | ConvertTo-Json)
Write-Check 'emergency closed with timeline' ($closedAlert.data.status -eq 'Closed' -and $closedAlert.data.timeline.Count -ge 4)

$ticket = Invoke-RestMethod "$BaseUrl/api/support/tickets" -Method Post -Headers $custAuth -ContentType 'application/json' `
    -Body (@{ type = 1; title = '配送延误投诉'; content = '订单延误超过一小时'; orderId = $order.data.id } | ConvertTo-Json)
Write-Check 'ticket submitted with merchant derived' ($ticket.data.status -eq 'Pending' -and $ticket.data.merchantId -eq $merchant2.data.id)

$merchantTickets = Invoke-RestMethod "$BaseUrl/api/support/tickets" -Headers $merchantAuth
Write-Check 'merchant sees related ticket' ($merchantTickets.data.total -ge 1)

$assignedTicket = Invoke-RestMethod "$BaseUrl/api/support/tickets/$($ticket.data.id)/assign" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ assigneeUserId = $login.data.user.id } | ConvertTo-Json)
Write-Check 'ticket assigned' ($assignedTicket.data.status -eq 'Processing' -and $assignedTicket.data.assigneeUserId -eq $login.data.user.id)

$staffReply = Invoke-RestMethod "$BaseUrl/api/support/tickets/$($ticket.data.id)/reply" -Method Post -Headers $merchantAuth -ContentType 'application/json' `
    -Body (@{ content = '已核实，正在协调赔付' } | ConvertTo-Json)
Write-Check 'staff reply recorded' ($staffReply.data.replies.Count -eq 1 -and $staffReply.data.replies[0].isStaff -eq $true)

$completedTicket = Invoke-RestMethod "$BaseUrl/api/support/tickets/$($ticket.data.id)/complete" -Method Post -Headers $auth
Write-Check 'ticket completed' ($completedTicket.data.status -eq 'Completed')

$ratedTicket = Invoke-RestMethod "$BaseUrl/api/support/tickets/$($ticket.data.id)/rate" -Method Post -Headers $custAuth -ContentType 'application/json' `
    -Body (@{ rating = 5; comment = '处理及时' } | ConvertTo-Json)
Write-Check 'ticket rated' ($ratedTicket.data.satisfactionRating -eq 5)

$closedTicket = Invoke-RestMethod "$BaseUrl/api/support/tickets/$($ticket.data.id)/close" -Method Post -Headers $auth
Write-Check 'ticket closed' ($closedTicket.data.status -eq 'Closed')

$ticketStats = Invoke-RestMethod "$BaseUrl/api/support/tickets/stats" -Headers $auth
Write-Check 'ticket stats' ($ticketStats.data.total -ge 1 -and $ticketStats.data.averageRating -ge 4)

$canned = Invoke-RestMethod "$BaseUrl/api/support/tickets/canned-responses" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ content = '您的投诉已收到，我们将在2小时内核实处理'; category = '投诉' } | ConvertTo-Json)
Write-Check 'canned response created' ($canned.data.content -like '*已收到*')

$article = Invoke-RestMethod "$BaseUrl/api/support/help/articles" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ title = "如何快速下单-$merchantPhone2"; category = '客户'; tags = '下单,教程'; contentType = 1; content = '三步完成下单：地址、物品、支付。'; isPublished = $true } | ConvertTo-Json)
Write-Check 'help article created' ($article.data.isPublished -eq $true)

$helpSearch = Invoke-RestMethod "$BaseUrl/api/help/articles?keyword=下单"
Write-Check 'help article searchable anonymously' ($helpSearch.data.total -ge 1)

$helpDetail = Invoke-RestMethod "$BaseUrl/api/help/articles/$($article.data.id)"
Write-Check 'help article view counted' ($helpDetail.data.viewCount -ge 1)

$helpCategories = Invoke-RestMethod "$BaseUrl/api/help/categories"
Write-Check 'help categories listed' ($helpCategories.data.Count -ge 1)

# ---------- M7 system config ----------

$systemParams = Invoke-RestMethod "$BaseUrl/api/admin/config/params" -Headers $auth
Write-Check 'system params seeded' ($systemParams.data.Count -ge 5)

$null = Invoke-RestMethod "$BaseUrl/api/admin/config/params" -Method Put -Headers $auth -ContentType 'application/json' `
    -Body (@{ items = @(@{ key = 'order.accept.timeout.minutes'; value = '20' }) } | ConvertTo-Json -Depth 4)

$backup = Invoke-RestMethod "$BaseUrl/api/admin/config/backups" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ scope = 'all' } | ConvertTo-Json)
Write-Check 'backup created' ($backup.data.status -eq 'Succeeded' -and $backup.data.sizeBytes -gt 100)

$paramsChanged = Invoke-RestMethod "$BaseUrl/api/admin/config/params" -Method Put -Headers $auth -ContentType 'application/json' `
    -Body (@{ items = @(@{ key = 'order.accept.timeout.minutes'; value = '25' }) } | ConvertTo-Json -Depth 4)
$changedValue = ($paramsChanged.data | Where-Object { $_.key -eq 'order.accept.timeout.minutes' }).value
Write-Check 'system param updated' ($changedValue -eq '25')

$restored = Invoke-RestMethod "$BaseUrl/api/admin/config/backups/$($backup.data.id)/restore" -Method Post -Headers $auth
Write-Check 'backup restored' ($restored.data.configCount -ge 5)

$paramsAfterRestore = Invoke-RestMethod "$BaseUrl/api/admin/config/params" -Headers $auth
$restoredValue = ($paramsAfterRestore.data | Where-Object { $_.key -eq 'order.accept.timeout.minutes' }).value
Write-Check 'param reverted by restore' ($restoredValue -eq '20')

$endpoint = Invoke-RestMethod "$BaseUrl/api/admin/config/endpoints" -Method Post -Headers $auth -ContentType 'application/json' `
    -Body (@{ name = '本服务健康检查'; url = 'http://localhost:5180/health'; method = 'GET'; isEnabled = $true; timeoutSeconds = 10; maxRetries = 1 } | ConvertTo-Json)
Write-Check 'external endpoint registered' ($endpoint.data.name -eq '本服务健康检查')

$endpointTest = Invoke-RestMethod "$BaseUrl/api/admin/config/endpoints/$($endpoint.data.id)/test" -Method Post -Headers $auth
Write-Check 'endpoint test succeeded' ($endpointTest.data.succeeded -eq $true -and $endpointTest.data.statusCode -eq 200)

$endpointLogs = Invoke-RestMethod "$BaseUrl/api/admin/config/endpoints/logs?pageSize=10" -Headers $auth
Write-Check 'interface call log recorded' ($endpointLogs.data.total -ge 1)

$auditLogs = Invoke-RestMethod "$BaseUrl/api/admin/config/logs?pageSize=10" -Headers $auth
Write-Check 'audit logs queryable' ($auditLogs.data.total -ge 1)

$logExportPath = Join-Path $samplesDir 'audit-logs-smoke.xlsx'
Invoke-WebRequest "$BaseUrl/api/admin/config/logs/export" -Method Post -Headers $auth -ContentType 'application/json' -OutFile $logExportPath `
    -Body (@{ pageNum = 1; pageSize = 100 } | ConvertTo-Json)
Write-Check 'audit logs exported' ((Get-Item $logExportPath).Length -gt 1000)

$cleanupResult = Invoke-RestMethod "$BaseUrl/api/admin/config/logs/cleanup" -Method Post -Headers $auth -ContentType 'application/json' -Body (@{ retentionDays = 180 } | ConvertTo-Json)
Write-Check 'log cleanup ran' ($cleanupResult.data.deleted -ge 0)

if ($script:failures -gt 0) {
    Write-Output "FAILED: $script:failures check(s)"
    exit 1
}

Write-Output 'ALL CHECKS PASSED'
exit 0
