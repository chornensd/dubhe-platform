# 移动端联调冒烟（Device-Type: Mobile）
# 验证：移动端登录裁剪、客户选商家/下单/支付、机长接单(起飞)/送达/拒单、故障上报与详情、文件上传、告警、通知
# 用法：先设置 DUBHE_TEST_PASSWORD（测试账号口令，见《测试账号文档.md》）与 DUBHE_ADMIN_PASSWORD，或通过参数传入
param(
    [string]$TestPassword = $env:DUBHE_TEST_PASSWORD,
    [string]$AdminPassword = $env:DUBHE_ADMIN_PASSWORD
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($TestPassword) -or [string]::IsNullOrWhiteSpace($AdminPassword)) {
    throw '缺少测试口令：请设置环境变量 DUBHE_TEST_PASSWORD / DUBHE_ADMIN_PASSWORD。'
}
$base = 'http://localhost:5180/api'
$H = @{ 'Content-Type' = 'application/json' }
$script:pass = 0
$script:fail = 0

function Check($name, [bool]$ok, $detail = '') {
  if ($ok) { $script:pass++; Write-Host "  [PASS] $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  [FAIL] $name $detail" -ForegroundColor Red }
}

function Login($account, $password, $device = 'Mobile') {
  $body = @{ account = $account; password = $password } | ConvertTo-Json
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -Headers ($H + @{ 'Device-Type' = $device }) -Body $body -NoProxy
  return $r.data
}

Write-Host "== 1. 移动端登录与字段裁剪 ==" -ForegroundColor Cyan
$customer = Login 'test_customer' $TestPassword
$pilot = Login 'test_pilot' $TestPassword
$merchant = Login 'test_merchant' $TestPassword
$admin = Login 'admin' $AdminPassword 'PC'
Check '客户登录成功' ($customer.accessToken.Length -gt 20)
Check '移动端裁剪 permissions（应为空）' ($null -eq $customer.user.permissions)
Check '移动端裁剪 email/lastLoginAt' ($null -eq $customer.user.email -and $null -eq $customer.user.lastLoginAt)
Check '机长登录成功' ($pilot.user.roles -contains 'Pilot')
Check '商家登录成功' ($merchant.user.roles -contains 'Merchant')

$CH = @{ Authorization = "Bearer $($customer.accessToken)"; 'Device-Type' = 'Mobile'; 'Content-Type' = 'application/json' }
$PH = @{ Authorization = "Bearer $($pilot.accessToken)"; 'Device-Type' = 'Mobile'; 'Content-Type' = 'application/json' }
$MH = @{ Authorization = "Bearer $($merchant.accessToken)"; 'Device-Type' = 'Mobile'; 'Content-Type' = 'application/json' }
$AH = @{ Authorization = "Bearer $($admin.accessToken)"; 'Device-Type' = 'PC'; 'Content-Type' = 'application/json' }

Write-Host "== 2. 客户：可选商家 / 预估 / 下单 / 支付 ==" -ForegroundColor Cyan
$merchants = (Invoke-RestMethod -Uri "$base/orders/available-merchants" -Headers $CH -NoProxy).data
Check '可选商家列表非空' ($merchants.Count -gt 0) "count=$($merchants.Count)"
$m = $merchants | Where-Object { $_.id -eq $merchant.user.id } | Select-Object -First 1
if (-not $m) { $m = $merchants[0] }
Check '商家含服务区域' ($m.serviceAreas.Count -ge 0)
$area = if ($m.serviceAreas.Count -gt 0) { $m.serviceAreas[0] } else { $null }
$lat = if ($area) { $area.centerLat } else { 30.2741 }
$lng = if ($area) { $area.centerLng } else { 120.1551 }

$orderBody = @{
  merchantId    = $m.id
  senderName    = '移动端测试寄件人'
  senderPhone   = '13900000001'
  senderAddress = '杭州市西湖区文三路 100 号'
  senderLat     = $lat
  senderLng     = $lng
  receiverName  = '移动端测试收件人'
  receiverPhone = '13900000002'
  receiverAddress = '杭州市西湖区文三路 200 号'
  receiverLat   = $lat + 0.01
  receiverLng   = $lng + 0.01
  itemCategory  = 'documents'
  itemName      = '移动端联调文件'
  weightKg      = 1.5
  volumeM3      = 0.01
  quantity      = 1
  isUrgent      = $true
  scheduledAt   = $null
  couponAmount  = 0
  remark        = '移动端冒烟订单'
} | ConvertTo-Json

$estimate = (Invoke-RestMethod -Method Post -Uri "$base/orders/estimate" -Headers ($H + @{ Authorization = "Bearer $($customer.accessToken)"; 'Device-Type' = 'Mobile' }) -Body $orderBody -NoProxy).data
Check '费用预估成功' ($estimate.fee.totalAmount -gt 0) "total=$($estimate.fee.totalAmount)"

$order = (Invoke-RestMethod -Method Post -Uri "$base/orders" -Headers ($H + @{ Authorization = "Bearer $($customer.accessToken)"; 'Device-Type' = 'Mobile' }) -Body $orderBody -NoProxy).data
Check '下单成功' ($order.id.Length -gt 0) "orderNo=$($order.orderNo)"

$pay = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order.id)/pay" -Headers ($H + @{ Authorization = "Bearer $($customer.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{ method = 1; simulateFailure = $false } | ConvertTo-Json) -NoProxy).data
Check '支付成功' ($pay.status -eq 'Succeeded') "status=$($pay.status)"

Write-Host "== 3. 商家接单/调度给机长 ==" -ForegroundColor Cyan
$accept = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order.id)/accept" -Headers $MH -NoProxy).data
Check '商家接单' ($accept.status -eq 'PendingDispatch')

$pilotUserId = $pilot.user.id
$drones = (Invoke-RestMethod -Uri "$base/resource/drones?pageSize=50" -Headers $MH -NoProxy).data.items
$drone = $drones | Where-Object { $_.status -eq 'Idle' } | Select-Object -First 1
if (-not $drone) {
  $serial = "TEST-MOB-$((Get-Date).ToString('MMddHHmmss'))"
  $drone = (Invoke-RestMethod -Method Post -Uri "$base/resource/drones" -Headers $MH -Body (@{
    serialNo = $serial; model = '移动端冒烟飞行器'; maxPayloadKg = 30; enduranceMinutes = 90; batteryPercent = 100
  } | ConvertTo-Json) -NoProxy).data
}
Check '商家可见/创建可用飞行器' ($null -ne $drone) "serial=$($drone.serialNo), status=$($drone.status)"

$dispatch = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order.id)/dispatch" -Headers $MH -Body (@{ droneId = $drone.id; pilotId = $pilotUserId; waypoints = $null; remark = '移动端联调调度' } | ConvertTo-Json) -NoProxy).data
Check '调度指派机长' ($dispatch.pilotId -eq $pilotUserId)

Write-Host "== 4. 机长：订单范围 / 开始飞行 / 完成送达 / 故障与上传 ==" -ForegroundColor Cyan
$pilotOrders = (Invoke-RestMethod -Uri "$base/orders?pageSize=50" -Headers $PH -NoProxy).data
$mine = $pilotOrders.items | Where-Object { $_.id -eq $order.id }
Check '机长可见被指派订单' ($null -ne $mine)

$started = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order.id)/start" -Headers $PH -NoProxy).data
Check '机长开始飞行（新权限 order.pilot.execute）' ($started.status -eq 'InFlight')

$png = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82)
$tmp = Join-Path $env:TEMP 'mobile-smoke.png'
[System.IO.File]::WriteAllBytes($tmp, $png)
$up = & curl.exe -s -X POST "$base/files/upload" -H "Authorization: Bearer $($pilot.accessToken)" -H "Device-Type: Mobile" -F "file=@$tmp;type=image/png" 
$upJson = $up | ConvertFrom-Json
Check '文件上传返回 URL' ($upJson.data.url -like '/uploads/*') "url=$($upJson.data.url)"
$fileUrl = "http://localhost:5180$($upJson.data.url)"
try { $fileCheck = Invoke-WebRequest -Uri $fileUrl -NoProxy -TimeoutSec 5; Check '上传文件可访问' ($fileCheck.StatusCode -eq 200) } catch { Check '上传文件可访问' $false $_.Exception.Message }

$fault = (Invoke-RestMethod -Method Post -Uri "$base/resource/faults" -Headers ($H + @{ Authorization = "Bearer $($pilot.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{
  droneId = $drone.id; faultType = '动力系统异常'; description = '移动端联调故障：右前桨异响'; photoUrls = @($upJson.data.url); lat = $lat; lng = $lng
} | ConvertTo-Json) -NoProxy).data
Check '机长上报故障' ($fault.status -eq 'Reported')
$faultDetail = (Invoke-RestMethod -Uri "$base/resource/faults/$($fault.id)" -Headers $PH -NoProxy).data
Check '故障详情接口（新增）' ($faultDetail.id -eq $fault.id)
$pilotFaults = (Invoke-RestMethod -Uri "$base/resource/faults?pageSize=50" -Headers $PH -NoProxy).data
Check '机长可见本人故障记录（范围修复）' (($pilotFaults.items | Where-Object { $_.id -eq $fault.id }).Count -eq 1)

$completed = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order.id)/complete" -Headers $PH -Body (@{ remark = '移动端联调送达' } | ConvertTo-Json) -NoProxy).data
Check '机长完成送达（新权限）' ($completed.status -eq 'Delivered')

Write-Host "== 5. 机长拒单（decline，原单已送达故新建一单） ==" -ForegroundColor Cyan
$orderBody2 = ($orderBody | ConvertFrom-Json)
$orderBody2.remark = '移动端拒单测试'
$orderBody2 | Add-Member -NotePropertyName 'x' -NotePropertyValue 1
$order2 = (Invoke-RestMethod -Method Post -Uri "$base/orders" -Headers ($H + @{ Authorization = "Bearer $($customer.accessToken)"; 'Device-Type' = 'Mobile' }) -Body ($orderBody2 | ConvertTo-Json) -NoProxy).data
Invoke-RestMethod -Method Post -Uri "$base/orders/$($order2.id)/accept" -Headers $MH -NoProxy | Out-Null
$dispatch2 = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order2.id)/dispatch" -Headers $MH -Body (@{ droneId = $drone.id; pilotId = $pilotUserId; waypoints = $null; remark = '拒单测试调度' } | ConvertTo-Json) -NoProxy).data
$declined = (Invoke-RestMethod -Method Post -Uri "$base/orders/$($order2.id)/decline" -Headers ($H + @{ Authorization = "Bearer $($pilot.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{ reason = '机长临时有任务' } | ConvertTo-Json) -NoProxy).data
Check '机长拒绝任务（新增）' ($declined.status -eq 'PendingDispatch' -and $null -eq $declined.pilotId)

Write-Host "== 6. 空域/告警/通知/发票 ==" -ForegroundColor Cyan
$zones = (Invoke-RestMethod -Uri "$base/airspace/zones?activeOnly=true&pageSize=20" -Headers $PH -NoProxy).data
Check '机长可查询空域（新增 airspace.read）' ($zones.pageNum -ge 1)
$pos = (Invoke-RestMethod -Method Post -Uri "$base/airspace/monitoring/positions" -Headers ($H + @{ Authorization = "Bearer $($pilot.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{ droneId = $drone.id; lat = $lat; lng = $lng; altitudeM = 66 } | ConvertTo-Json) -NoProxy).data
Check '位置上报成功' ($null -ne $pos)

$alerts = (Invoke-RestMethod -Uri "$base/support/emergency-alerts?pageSize=5" -Headers $PH -NoProxy).data
Check '机长可查看应急告警' ($alerts.pageNum -ge 1)
$alert = (Invoke-RestMethod -Method Post -Uri "$base/support/emergency-alerts" -Headers ($H + @{ Authorization = "Bearer $($pilot.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{ title = '移动端联调告警'; content = '测试告警内容：电量告警演练'; level = 2; source = '人工上报' } | ConvertTo-Json) -NoProxy).data
Check '机长可上报告警' ($alert.level -eq 'Serious')
Invoke-RestMethod -Method Post -Uri "$base/support/emergency-alerts/$($alert.id)/progress" -Headers ($H + @{ Authorization = "Bearer $($pilot.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{ note = '已联系就近换电站'; status = 2 } | ConvertTo-Json) -NoProxy | Out-Null
$alertDetail = (Invoke-RestMethod -Uri "$base/support/emergency-alerts/$($alert.id)" -Headers $PH -NoProxy).data
Check '告警进展写入时间线' ($alertDetail.timeline.Count -ge 1)

$notifications = (Invoke-RestMethod -Uri "$base/notifications?pageSize=5&unreadOnly=false" -Headers $PH -NoProxy).data
Check '机长可查询通知' ($notifications.pageNum -ge 1)

$inv = (Invoke-RestMethod -Method Post -Uri "$base/invoices" -Headers ($H + @{ Authorization = "Bearer $($customer.accessToken)"; 'Device-Type' = 'Mobile' }) -Body (@{ orderIds = @($order.id); title = '移动端测试公司'; taxNo = '91330100TEST0001' } | ConvertTo-Json) -NoProxy).data
Check '客户申请发票' ($inv.status -eq 'Submitted')

Write-Host ""
Write-Host "结果：$($script:pass) 通过 / $($script:fail) 失败" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
if ($script:fail -gt 0) { exit 1 }
