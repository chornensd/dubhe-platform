namespace Dubhe.Domain.Auth;

public sealed record PermissionDef(string Code, string Name, string Module);

public sealed record RoleDef(string Code, string Name, string Description);

public static class RoleCodes
{
    public const string Admin = "Admin";
    public const string Merchant = "Merchant";
    public const string Dispatcher = "Dispatcher";
    public const string Finance = "Finance";
    public const string Operator = "Operator";
    public const string Pilot = "Pilot";
    public const string OperationsStaff = "OperationsStaff";
    public const string AirTrafficController = "AirTrafficController";
    public const string Customer = "Customer";
    public const string PublicUser = "PublicUser";
}

public static class PermissionCatalog
{
    public static readonly IReadOnlyList<PermissionDef> All = new List<PermissionDef>
    {
        new("account.user.read", "查看账号", "account"),
        new("account.user.manage", "账号管理", "account"),
        new("account.role.manage", "角色权限管理", "account"),
        new("account.audit.read", "审计日志查看", "account"),

        new("order.read", "查看订单", "order"),
        new("order.create", "创建订单", "order"),
        new("order.accept", "接单/拒单", "order"),
        new("order.dispatch", "订单调度", "order"),
        new("order.pilot.execute", "执行飞行任务", "order"),
        new("order.settle", "结算对账", "order"),
        new("order.review", "评价与投诉处理", "order"),
        new("order.pay", "订单支付", "order"),
        new("order.invoice.apply", "发票申请", "order"),
        new("order.invoice.manage", "发票管理", "order"),

        new("resource.drone.read", "查看飞行器", "resource"),
        new("resource.drone.manage", "飞行器管理", "resource"),
        new("resource.station.read", "查看场站", "resource"),
        new("resource.station.manage", "场站管理", "resource"),
        new("resource.crew.manage", "人员管理", "resource"),
        new("resource.maintenance.manage", "维保管理", "resource"),
        new("resource.fault.report", "故障上报", "resource"),
        new("resource.fault.manage", "故障处理", "resource"),
        new("resource.service-area.manage", "服务区域配置", "resource"),

        new("airspace.read", "空域查看", "airspace"),
        new("airspace.plan.submit", "飞行计划申报", "airspace"),
        new("airspace.plan.approve", "飞行计划审批", "airspace"),
        new("airspace.fence.manage", "电子围栏管理", "airspace"),
        new("airspace.zone.manage", "空域数据管理", "airspace"),
        new("airspace.violation.manage", "违规处理", "airspace"),
        new("airspace.violation.read", "违规记录查看", "airspace"),
        new("airspace.monitoring.report", "飞行位置上报", "airspace"),

        new("report.view", "查看报表", "report"),
        new("report.export", "导出报表", "report"),
        new("report.share", "分享报表", "report"),

        new("support.alert.handle", "应急告警处置", "support"),
        new("support.ticket.manage", "工单管理", "support"),
        new("support.ticket.apply", "工单提交", "support"),
        new("support.help.manage", "帮助中心管理", "support"),

        new("config.param.manage", "参数配置", "config"),
        new("config.interface.manage", "接口管理", "config"),
        new("config.backup.manage", "备份管理", "config"),
        new("config.log.read", "日志查看", "config"),

        new("agent.use", "智能体使用", "agent"),
        new("agent.manage", "知识库管理", "agent")
    };

    public static readonly IReadOnlyList<RoleDef> Roles = new List<RoleDef>
    {
        new(RoleCodes.Admin, "平台管理员", "全平台监管、系统配置与数据统计"),
        new(RoleCodes.Merchant, "商家", "企业运营主账号，负责接单调度与资源管理"),
        new(RoleCodes.Dispatcher, "调度员", "订单调度与资源调配"),
        new(RoleCodes.Finance, "财务", "结算、对账与发票"),
        new(RoleCodes.Operator, "操作员", "资源与维保操作"),
        new(RoleCodes.Pilot, "机长", "执行飞行任务与故障上报"),
        new(RoleCodes.OperationsStaff, "运维人员", "平台与设备运维"),
        new(RoleCodes.AirTrafficController, "空管监管人员", "空域监管与飞行计划审批"),
        new(RoleCodes.Customer, "客户", "下单、支付与订单跟踪"),
        new(RoleCodes.PublicUser, "公众/第三方", "信息服务与资源对接")
    };

    public static IReadOnlyDictionary<string, string[]> DefaultRolePermissions { get; } =
        new Dictionary<string, string[]>
        {
            [RoleCodes.Admin] = new[] { "*" },
            [RoleCodes.Merchant] = new[]
            {
                "account.user.read", "account.user.manage",
                "order.read", "order.accept", "order.dispatch", "order.settle", "order.review", "order.invoice.apply",
                "resource.drone.read", "resource.drone.manage", "resource.station.read", "resource.station.manage",
                "resource.crew.manage", "resource.maintenance.manage",
                "resource.fault.report", "resource.fault.manage", "resource.service-area.manage",
                "airspace.read", "airspace.plan.submit", "airspace.fence.manage", "airspace.monitoring.report", "airspace.violation.read",
                "report.view", "report.export", "report.share",
                "support.alert.handle", "support.ticket.manage", "support.ticket.apply"
            },
            [RoleCodes.Dispatcher] = new[]
            {
                "order.read", "order.accept", "order.dispatch",
                "resource.drone.read", "resource.drone.manage",
                "resource.station.read", "resource.station.manage",
                "airspace.read", "airspace.plan.submit", "airspace.monitoring.report"
            },
            [RoleCodes.Finance] = new[]
            {
                "order.read", "order.settle", "order.invoice.apply", "report.view", "report.export"
            },
            [RoleCodes.Operator] = new[]
            {
                "order.read", "resource.drone.read", "resource.drone.manage",
                "resource.station.read", "resource.station.manage",
                "resource.maintenance.manage", "resource.fault.report", "resource.fault.manage",
                "airspace.monitoring.report"
            },
            [RoleCodes.Pilot] = new[]
            {
                "order.read", "order.pilot.execute", "support.alert.handle", "resource.fault.report",
                "airspace.monitoring.report", "resource.drone.read", "airspace.read"
            },
            [RoleCodes.OperationsStaff] = new[]
            {
                "resource.drone.read", "resource.drone.manage", "resource.station.read", "resource.station.manage",
                "resource.maintenance.manage", "resource.fault.report", "resource.fault.manage",
                "support.alert.handle", "support.help.manage", "config.log.read",
                "airspace.monitoring.report", "airspace.violation.read"
            },
            [RoleCodes.AirTrafficController] = new[]
            {
                "airspace.read", "airspace.plan.approve", "airspace.fence.manage", "airspace.violation.manage",
                "airspace.zone.manage", "airspace.violation.read", "airspace.monitoring.report",
                "report.view", "report.export"
            },
            [RoleCodes.Customer] = new[]
            {
                "order.create", "order.read", "order.review", "order.pay", "order.invoice.apply", "support.ticket.apply"
            },
            [RoleCodes.PublicUser] = Array.Empty<string>()
        };
}
