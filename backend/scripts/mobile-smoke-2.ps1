# 移动端第二批联调冒烟（运维 + 移动管理员，Device-Type: Mobile）
# 覆盖：运维资源域访问（设备/场站/维保/故障）、维保计划与记录、故障闭环、管理员审批（注册/飞行计划）、应急告警下发处置闭环
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
$H = @{ 'Content-Type' = 'application/json'; 'Device-Type' = 'Mobile' }
$script:pass = 0
$script:fail = 0

function Check($name, [bool]$ok, $detail = '') {
  if ($ok) { $script:pass++; Write-Host "  [PASS] $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  [FAIL] $name $detail" -ForegroundColor Red }
}

function Login($account, $password) {
  return (Invoke-RestMethod -Method Post -Uri "$base/auth/login" -Headers $H -Body (@{ account = $account; password = $password } | ConvertTo-Json) -NoProxy).data
}

Write-Host "== 1. 运维：资源域访问（修复前全部 403） ==" -ForegroundColor Cyan
$ops = Login 'test_ops' $TestPassword
$opsToken = $ops.accessToken
$OH = @{ Authorization = "Bearer $opsToken"; 'Device-Type' = 'Mobile'; 'Content-Type' = 'application/json' }
Check '运维登录' ($ops.user.roles -contains 'OperationsStaff')

$drones = (Invoke-RestMethod -Uri "$base/resource/drones?pageNum=1&pageSize=50" -Headers $OH -NoProxy).data
Check '设备列表可访问' ($drones.pageNum -ge 1) "total=$($drones.total)"
$stations = (Invoke-RestMethod -Uri "$base/resource/stations?pageNum=1&pageSize=20" -Headers $OH -NoProxy).data
Check '场站列表可访问' ($stations.pageNum -ge 1) "total=$($stations.total)"
$plans = (Invoke-RestMethod -Uri "$base/resource/maintenance/plans" -Headers $OH -NoProxy).data
Check '维保计划可访问' ($null -ne $plans) "count=$($plans.Count)"
$records = (Invoke-RestMethod -Uri "$base/resource/maintenance/records" -Headers $OH -NoProxy).data
Check '维保记录可访问（数组）' ($records.Count -ge 1) "count=$($records.Count)"

Write-Host "== 2. 运维：维保计划设置 / 记录登记 / 场站预约处置 ==" -ForegroundColor Cyan
$drone = $drones.items | Select-Object -First 1
$plan = (Invoke-RestMethod -Method Post -Uri "$base/resource/maintenance/plans" -Headers $OH -Body (@{
  droneId = $drone.id; intervalDays = 90; intervalFlightMinutes = 100; enabled = $true; remark = '移动端冒烟计划'
} | ConvertTo-Json) -NoProxy).data
Check '维保计划保存（运维）' ($plan.droneId -eq $drone.id) "status=$($plan.status)"

$record = (Invoke-RestMethod -Method Post -Uri "$base/resource/maintenance/records" -Headers $OH -Body (@{
  droneId = $drone.id; planId = $plan.id; type = '例行维保'; content = '移动端冒烟：例行检查完成'
} | ConvertTo-Json) -NoProxy).data
Check '维保记录登记（运维）' ($record.droneId -eq $drone.id)

$station = $stations.items | Select-Object -First 1
if ($station) {
  $reservations = (Invoke-RestMethod -Uri "$base/resource/stations/$($station.id)/reservations" -Headers $OH -NoProxy).data
  Check '场站预约可查看（运维，数组）' ($reservations.Count -ge 0) "count=$($reservations.Count)"
  $cancellable = $reservations | Where-Object { $_.status -eq 'Reserved' } | Select-Object -First 1
  if ($cancellable) {
    Invoke-RestMethod -Method Post -Uri "$base/resource/reservations/$($cancellable.id)/cancel" -Headers $OH -NoProxy | Out-Null
    Check '预约取消处置（运维）' $true
  } else {
    Check '预约取消处置（运维）' $true '（当前无 Reserved 预约，跳过）'
  }
} else {
  Check '场站预约可查看（运维）' $false '无场站数据'
}

Write-Host "== 3. 运维：故障闭环（处理结果写入维保记录） ==" -ForegroundColor Cyan
$fault = (Invoke-RestMethod -Method Post -Uri "$base/resource/faults" -Headers $OH -Body (@{
  droneId = $drone.id; faultType = '电池异常'; description = '移动端冒烟：电池压差偏大'; photoUrls = @()
} | ConvertTo-Json) -NoProxy).data
Check '故障上报' ($fault.status -eq 'Reported')
$resolved = (Invoke-RestMethod -Method Post -Uri "$base/resource/faults/$($fault.id)/resolve" -Headers $OH -Body (@{ resolution = '更换电池并复测通过' } | ConvertTo-Json) -NoProxy).data
Check '故障闭环（运维）' ($resolved.status -eq 'Resolved')

Write-Host "== 4. 管理员：商家注册审批 ==" -ForegroundColor Cyan
$admin = Login 'admin' $AdminPassword
$AH = @{ Authorization = "Bearer $($admin.accessToken)"; 'Device-Type' = 'Mobile'; 'Content-Type' = 'application/json' }
$suffix = (Get-Date).ToString('HHmmss')
$regBody = @{
  username = "smoke_m2_$suffix"; phone = "13988$($suffix.PadLeft(6,'0'))".Substring(0, 11); password = $TestPassword;
  displayName = "移动端冒烟商家$suffix"; userType = 3; companyName = "冒烟企业$suffix"
} | ConvertTo-Json
$reg = (Invoke-RestMethod -Method Post -Uri "$base/auth/register" -Headers $H -Body $regBody -NoProxy).data
Check '注册待审核商家' ($reg.status -eq 'PendingReview') "status=$($reg.status)"

$pending = (Invoke-RestMethod -Uri "$base/admin/users?pageNum=1&pageSize=5&status=0" -Headers $AH -NoProxy).data
Check '待审核账号列表（管理员）' ($pending.pageNum -ge 1) "total=$($pending.total)"
$target = $pending.items | Where-Object { $_.username -eq "smoke_m2_$suffix" } | Select-Object -First 1
if (-not $target) { $target = $pending.items | Select-Object -First 1 }
Invoke-RestMethod -Method Post -Uri "$base/admin/users/$($target.id)/approve" -Headers $AH -NoProxy | Out-Null
$after = (Invoke-RestMethod -Uri "$base/admin/users?pageNum=1&pageSize=50&keyword=$($target.username)" -Headers $AH -NoProxy).data.items | Select-Object -First 1
Check '注册审批通过' ($after.status -eq 'Active') "status=$($after.status)"

Write-Host "== 5. 管理员：飞行计划审批 ==" -ForegroundColor Cyan
$planPage = (Invoke-RestMethod -Uri "$base/airspace/flight-plans?pageNum=1&pageSize=10&status=2" -Headers $AH -NoProxy).data
Check '待审批飞行计划列表' ($planPage.pageNum -ge 1) "total=$($planPage.total)"
$pendingPlan = $planPage.items | Select-Object -First 1
if ($pendingPlan) {
  $suggestion = (Invoke-RestMethod -Uri "$base/airspace/flight-plans/$($pendingPlan.id)/approval-suggestion" -Headers $AH -NoProxy).data
  Check '审批建议可用' ($null -ne $suggestion.suggestion) "suggestion=$($suggestion.suggestion)"
  $approved = (Invoke-RestMethod -Method Post -Uri "$base/airspace/flight-plans/$($pendingPlan.id)/approve" -Headers $AH -Body (@{ comment = '移动端冒烟批准' } | ConvertTo-Json) -NoProxy).data
  Check '飞行计划批准' ($approved.status -eq 'Approved') "status=$($approved.status)"
} else {
  Write-Host "  [SKIP] 当前无待审批计划（无飞行计划数据）" -ForegroundColor Yellow
}

Write-Host "== 6. 管理员：应急告警下发处置闭环 ==" -ForegroundColor Cyan
$alert = (Invoke-RestMethod -Method Post -Uri "$base/support/emergency-alerts" -Headers $AH -Body (@{
  title = '移动端冒烟告警'; content = '管理员下发处置冒烟：模拟通信中断'; level = 3; source = '人工上报'
} | ConvertTo-Json) -NoProxy).data
Check '告警上报（管理员）' ($alert.level -eq 'Critical')

$dispatched = (Invoke-RestMethod -Method Post -Uri "$base/support/emergency-alerts/$($alert.id)/dispatch" -Headers $AH -Body (@{
  handlers = @($ops.user.id); plan = '立即切换备用链路并现场核查'; deadlineAt = (Get-Date).AddHours(2).ToUniversalTime().ToString('o')
} | ConvertTo-Json) -NoProxy).data
Check '下发处置（指派处理人）' ($dispatched.status -eq 'Handling') "status=$($dispatched.status)"
Check '处理人已记录' ($dispatched.handlers -contains $ops.user.id)

Invoke-RestMethod -Method Post -Uri "$base/support/emergency-alerts/$($alert.id)/progress" -Headers $OH -Body (@{ note = '运维已到场，备用链路已启用'; status = 3 } | ConvertTo-Json) -NoProxy | Out-Null
$closed = (Invoke-RestMethod -Method Post -Uri "$base/support/emergency-alerts/$($alert.id)/close" -Headers $AH -Body (@{ result = '链路恢复，告警关闭' } | ConvertTo-Json) -NoProxy).data
Check '告警关闭归档' ($closed.status -eq 'Closed') "status=$($closed.status)"

$detail = (Invoke-RestMethod -Uri "$base/support/emergency-alerts/$($alert.id)" -Headers $AH -NoProxy).data
Check '处置时间线完整（≥3 条）' ($detail.timeline.Count -ge 3) "timeline=$($detail.timeline.Count)"

Write-Host ""
Write-Host "结果：$($script:pass) 通过 / $($script:fail) 失败" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
if ($script:fail -gt 0) { exit 1 }
