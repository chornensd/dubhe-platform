export interface NavItem {
  label: string;
  icon?: string;
  path?: string;
  /** 命中任一权限点即可见 */
  perm?: string[];
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** 侧边菜单（按权限点过滤；Admin 通配由 PermissionService 处理） */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: '运营',
    items: [
      { label: '工作台', icon: 'dashboard', path: '/dashboard' },
      {
        label: '订单管理',
        icon: 'shopping-cart',
        children: [
          { label: '订单列表', path: '/orders', perm: ['order.read'] },
          { label: '新建订单', path: '/orders/create', perm: ['order.create'] },
          { label: '批量导入', path: '/orders/import', perm: ['order.create'] },
          { label: '自动接单规则', path: '/orders/auto-accept', perm: ['order.accept'] },
        ],
      },
      {
        label: '结算与发票',
        icon: 'account-book',
        children: [
          { label: '结算单', path: '/finance/settlements', perm: ['order.settle'] },
          { label: '发票管理', path: '/finance/invoices', perm: ['order.invoice.apply', 'order.invoice.manage'] },
        ],
      },
    ],
  },
  {
    label: '资源与空域',
    items: [
      {
        label: '低空资源',
        icon: 'rocket',
        children: [
          { label: '飞行器台账', path: '/resources/drones', perm: ['resource.drone.read'] },
          { label: '起降场站', path: '/resources/stations', perm: ['resource.station.read'] },
          { label: '服务区域', path: '/resources/service-areas', perm: ['resource.service-area.manage'] },
          { label: '人员与资质', path: '/resources/crew', perm: ['resource.crew.manage'] },
          { label: '维保管理', path: '/resources/maintenance', perm: ['resource.maintenance.manage'] },
          { label: '故障处理', path: '/resources/faults', perm: ['resource.fault.report', 'resource.fault.manage'] },
        ],
      },
      {
        label: '空域合规',
        icon: 'global',
        children: [
          { label: '空域与围栏', path: '/airspace/zones', perm: ['airspace.read'] },
          { label: '飞行计划', path: '/airspace/flight-plans', perm: ['airspace.read'] },
          { label: '违规处理', path: '/airspace/violations', perm: ['airspace.violation.read', 'airspace.violation.manage'] },
          { label: '飞行监控', path: '/airspace/monitoring', perm: ['airspace.monitoring.report', 'airspace.read'] },
        ],
      },
    ],
  },
  {
    label: '分析与服务',
    items: [
      {
        label: '统计报表',
        icon: 'bar-chart',
        children: [
          { label: '管理员看板', path: '/reports/admin', perm: ['report.view'] },
          { label: '商家看板', path: '/reports/merchant', perm: ['report.view'] },
          { label: '空管看板', path: '/reports/atc', perm: ['report.view'] },
          { label: '自定义报表', path: '/reports/custom', perm: ['report.view'] },
          { label: '报表模板', path: '/reports/templates', perm: ['report.view'] },
          { label: '报表分享', path: '/reports/shares', perm: ['report.view', 'report.share'] },
        ],
      },
      {
        label: '应急与客服',
        icon: 'alert',
        children: [
          { label: '应急告警', path: '/support/alerts', perm: ['support.alert.handle'] },
          { label: '客服工单', path: '/support/tickets', perm: ['support.ticket.apply', 'support.ticket.manage'] },
          { label: '客服常用语', path: '/support/canned', perm: ['support.ticket.manage'] },
          { label: '帮助中心', path: '/support/help' },
        ],
      },
      {
        label: '智能体',
        icon: 'robot',
        children: [
          { label: '智能体信息', path: '/agent/info', perm: ['agent.use'] },
          { label: '知识库', path: '/agent/knowledge', perm: ['agent.use'] },
          { label: '智能体任务', path: '/agent/tasks', perm: ['agent.use'] },
          { label: '团队协定', path: '/agent/protocols', perm: ['agent.use'] },
        ],
      },
    ],
  },
  {
    label: '系统',
    items: [
      {
        label: '账号权限',
        icon: 'team',
        children: [
          { label: '用户管理', path: '/admin/users', perm: ['account.user.manage'] },
          { label: '角色与权限', path: '/admin/roles', perm: ['account.role.manage'] },
        ],
      },
      {
        label: '系统配置',
        icon: 'setting',
        children: [
          { label: '参数配置', path: '/config/params', perm: ['config.param.manage'] },
          { label: '接口管理', path: '/config/endpoints', perm: ['config.interface.manage'] },
          { label: '备份与恢复', path: '/config/backups', perm: ['config.backup.manage'] },
          { label: '操作日志', path: '/config/logs', perm: ['config.log.read'] },
        ],
      },
      {
        label: '个人',
        icon: 'user',
        children: [
          { label: '我的资料', path: '/profile' },
          { label: '消息通知', path: '/notifications' },
        ],
      },
    ],
  },
];

/** 各角色默认落地页 */
export function defaultHome(roles: string[], permissions: string[]): string {
  const has = (code: string) => permissions.includes('*') || permissions.includes(code);
  if (roles.includes('AirTrafficController') && !roles.includes('Admin')) {
    return has('report.view') ? '/reports/atc' : '/airspace/flight-plans';
  }
  if (roles.includes('Admin')) return '/dashboard';
  if (roles.includes('Customer') && !roles.some((r) => ['Merchant', 'Dispatcher', 'Finance', 'Operator'].includes(r))) {
    return has('order.read') ? '/orders' : '/dashboard';
  }
  if (roles.includes('Pilot') && !roles.some((r) => ['Merchant', 'Dispatcher'].includes(r))) {
    return has('airspace.monitoring.report') ? '/airspace/monitoring' : '/orders';
  }
  return '/dashboard';
}
