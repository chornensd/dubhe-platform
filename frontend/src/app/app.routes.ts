import { Routes } from '@angular/router';
import { authGuard, guestGuard, permGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: 'login', loadComponent: () => import('./pages/auth/login').then((m) => m.LoginPage), title: '登录 · 天枢低空管控平台' },
      { path: 'register', loadComponent: () => import('./pages/auth/register').then((m) => m.RegisterPage), title: '注册 · 天枢低空管控平台' },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/app-layout').then((m) => m.AppLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage), title: '工作台 · 天枢' },
      { path: 'forbidden', loadComponent: () => import('./pages/forbidden').then((m) => m.ForbiddenPage), title: '无权访问 · 天枢' },

      {
        path: 'orders',
        children: [
          { path: '', loadComponent: () => import('./pages/orders/order-list').then((m) => m.OrderListPage), canActivate: [permGuard(['order.read'])], title: '订单列表 · 天枢' },
          { path: 'create', loadComponent: () => import('./pages/orders/order-create').then((m) => m.OrderCreatePage), canActivate: [permGuard(['order.create'])], title: '新建订单 · 天枢' },
          { path: 'import', loadComponent: () => import('./pages/orders/order-import').then((m) => m.OrderImportPage), canActivate: [permGuard(['order.create'])], title: '订单导入 · 天枢' },
          { path: 'auto-accept', loadComponent: () => import('./pages/orders/auto-accept').then((m) => m.AutoAcceptPage), canActivate: [permGuard(['order.accept'])], title: '自动接单 · 天枢' },
          { path: ':id', loadComponent: () => import('./pages/orders/order-detail').then((m) => m.OrderDetailPage), canActivate: [permGuard(['order.read'])], title: '订单详情 · 天枢' },
        ],
      },
      {
        path: 'finance',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'settlements' },
          { path: 'settlements', loadComponent: () => import('./pages/finance/settlement-list').then((m) => m.SettlementListPage), canActivate: [permGuard(['order.settle'])], title: '结算单 · 天枢' },
          { path: 'settlements/:id', loadComponent: () => import('./pages/finance/settlement-detail').then((m) => m.SettlementDetailPage), canActivate: [permGuard(['order.settle'])], title: '结算详情 · 天枢' },
          { path: 'invoices', loadComponent: () => import('./pages/finance/invoice-list').then((m) => m.InvoiceListPage), canActivate: [permGuard(['order.invoice.apply', 'order.invoice.manage'])], title: '发票管理 · 天枢' },
        ],
      },
      {
        path: 'resources',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'drones' },
          { path: 'drones', loadComponent: () => import('./pages/resources/drone-list').then((m) => m.DroneListPage), canActivate: [permGuard(['resource.drone.read'])], title: '飞行器台账 · 天枢' },
          { path: 'stations', loadComponent: () => import('./pages/resources/station-list').then((m) => m.StationListPage), canActivate: [permGuard(['resource.station.read'])], title: '起降场站 · 天枢' },
          { path: 'service-areas', loadComponent: () => import('./pages/resources/service-areas').then((m) => m.ServiceAreaPage), canActivate: [permGuard(['resource.service-area.manage'])], title: '服务区域 · 天枢' },
          { path: 'crew', loadComponent: () => import('./pages/resources/crew-list').then((m) => m.CrewListPage), canActivate: [permGuard(['resource.crew.manage'])], title: '人员与资质 · 天枢' },
          { path: 'crew/:id', loadComponent: () => import('./pages/resources/crew-detail').then((m) => m.CrewDetailPage), canActivate: [permGuard(['resource.crew.manage'])], title: '人员详情 · 天枢' },
          { path: 'maintenance', loadComponent: () => import('./pages/resources/maintenance').then((m) => m.MaintenancePage), canActivate: [permGuard(['resource.maintenance.manage'])], title: '维保管理 · 天枢' },
          { path: 'faults', loadComponent: () => import('./pages/resources/faults').then((m) => m.FaultListPage), canActivate: [permGuard(['resource.fault.report', 'resource.fault.manage'])], title: '故障处理 · 天枢' },
        ],
      },
      {
        path: 'airspace',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'zones' },
          { path: 'zones', loadComponent: () => import('./pages/airspace/zones').then((m) => m.AirspaceZonePage), canActivate: [permGuard(['airspace.read'])], title: '空域与围栏 · 天枢' },
          { path: 'flight-plans', loadComponent: () => import('./pages/airspace/flight-plan-list').then((m) => m.FlightPlanListPage), canActivate: [permGuard(['airspace.read'])], title: '飞行计划 · 天枢' },
          { path: 'flight-plans/:id', loadComponent: () => import('./pages/airspace/flight-plan-detail').then((m) => m.FlightPlanDetailPage), canActivate: [permGuard(['airspace.read'])], title: '计划详情 · 天枢' },
          { path: 'violations', loadComponent: () => import('./pages/airspace/violations').then((m) => m.ViolationPage), canActivate: [permGuard(['airspace.violation.read', 'airspace.violation.manage'])], title: '违规处理 · 天枢' },
          { path: 'monitoring', loadComponent: () => import('./pages/airspace/monitoring').then((m) => m.MonitoringPage), canActivate: [permGuard(['airspace.monitoring.report', 'airspace.read'])], title: '飞行监控 · 天枢' },
        ],
      },
      {
        path: 'reports',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'admin' },
          { path: 'admin', loadComponent: () => import('./pages/reports/dashboard-admin').then((m) => m.AdminDashboardPage), canActivate: [permGuard(['report.view'])], title: '管理员看板 · 天枢' },
          { path: 'merchant', loadComponent: () => import('./pages/reports/dashboard-merchant').then((m) => m.MerchantDashboardPage), canActivate: [permGuard(['report.view'])], title: '商家看板 · 天枢' },
          { path: 'atc', loadComponent: () => import('./pages/reports/dashboard-atc').then((m) => m.AtcDashboardPage), canActivate: [permGuard(['report.view'])], title: '空管看板 · 天枢' },
          { path: 'custom', loadComponent: () => import('./pages/reports/custom-report').then((m) => m.CustomReportPage), canActivate: [permGuard(['report.view'])], title: '自定义报表 · 天枢' },
          { path: 'templates', loadComponent: () => import('./pages/reports/templates').then((m) => m.ReportTemplatePage), canActivate: [permGuard(['report.view'])], title: '报表模板 · 天枢' },
          { path: 'shares', loadComponent: () => import('./pages/reports/shares').then((m) => m.ReportSharePage), canActivate: [permGuard(['report.view', 'report.share'])], title: '报表分享 · 天枢' },
        ],
      },
      {
        path: 'support',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'help' },
          { path: 'alerts', loadComponent: () => import('./pages/support/alerts').then((m) => m.AlertListPage), canActivate: [permGuard(['support.alert.handle'])], title: '应急告警 · 天枢' },
          { path: 'alerts/:id', loadComponent: () => import('./pages/support/alert-detail').then((m) => m.AlertDetailPage), canActivate: [permGuard(['support.alert.handle'])], title: '告警处置 · 天枢' },
          { path: 'tickets', loadComponent: () => import('./pages/support/tickets').then((m) => m.TicketListPage), canActivate: [permGuard(['support.ticket.apply', 'support.ticket.manage'])], title: '客服工单 · 天枢' },
          { path: 'tickets/:id', loadComponent: () => import('./pages/support/ticket-detail').then((m) => m.TicketDetailPage), canActivate: [permGuard(['support.ticket.apply', 'support.ticket.manage'])], title: '工单详情 · 天枢' },
          { path: 'canned', loadComponent: () => import('./pages/support/canned').then((m) => m.CannedResponsePage), canActivate: [permGuard(['support.ticket.manage'])], title: '客服常用语 · 天枢' },
          { path: 'help', loadComponent: () => import('./pages/support/help').then((m) => m.HelpCenterPage), title: '帮助中心 · 天枢' },
        ],
      },
      {
        path: 'config',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'params' },
          { path: 'params', loadComponent: () => import('./pages/config/params').then((m) => m.ConfigParamPage), canActivate: [permGuard(['config.param.manage'])], title: '参数配置 · 天枢' },
          { path: 'endpoints', loadComponent: () => import('./pages/config/endpoints').then((m) => m.EndpointPage), canActivate: [permGuard(['config.interface.manage'])], title: '接口管理 · 天枢' },
          { path: 'backups', loadComponent: () => import('./pages/config/backups').then((m) => m.BackupPage), canActivate: [permGuard(['config.backup.manage'])], title: '备份与恢复 · 天枢' },
          { path: 'logs', loadComponent: () => import('./pages/config/logs').then((m) => m.LogsPage), canActivate: [permGuard(['config.log.read'])], title: '操作日志 · 天枢' },
        ],
      },
      {
        path: 'admin',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'users' },
          { path: 'users', loadComponent: () => import('./pages/admin/users').then((m) => m.AdminUserPage), canActivate: [permGuard(['account.user.manage'])], title: '用户管理 · 天枢' },
          { path: 'roles', loadComponent: () => import('./pages/admin/roles').then((m) => m.RolePermissionPage), canActivate: [permGuard(['account.role.manage'])], title: '角色与权限 · 天枢' },
        ],
      },
      {
        path: 'agent',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'info' },
          { path: 'info', loadComponent: () => import('./pages/agent/info').then((m) => m.AgentInfoPage), title: '智能体信息 · 天枢' },
          { path: 'knowledge', loadComponent: () => import('./pages/agent/knowledge').then((m) => m.KnowledgePage), title: '知识库 · 天枢' },
          { path: 'tasks', loadComponent: () => import('./pages/agent/tasks').then((m) => m.AgentTaskPage), title: '智能体任务 · 天枢' },
          { path: 'protocols', loadComponent: () => import('./pages/agent/protocols').then((m) => m.ProtocolPage), title: '团队协定 · 天枢' },
        ],
      },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage), title: '我的资料 · 天枢' },
      { path: 'notifications', loadComponent: () => import('./pages/profile/notifications').then((m) => m.NotificationPage), title: '消息通知 · 天枢' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
