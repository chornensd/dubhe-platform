import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/app_map.dart';
import '../widgets/common.dart';

/// 审批中心：飞行计划 / 商家注册 待办，支持快速批准与驳回。
class AdminApprovalsPage extends ConsumerStatefulWidget {
  const AdminApprovalsPage({super.key});

  @override
  ConsumerState<AdminApprovalsPage> createState() =>
      _AdminApprovalsPageState();
}

class _AdminApprovalsPageState extends ConsumerState<AdminApprovalsPage> {
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: AppScaffold(
        title: '审批中心',
        body: Column(
          children: [
            Container(
              color: Colors.white,
              child: const TabBar(
                tabs: [Tab(text: '飞行计划'), Tab(text: '商家注册')],
              ),
            ),
            const Expanded(
              child: TabBarView(
                children: [_FlightPlanApprovalTab(), _UserApprovalTab()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FlightPlanApprovalTab extends ConsumerStatefulWidget {
  const _FlightPlanApprovalTab();

  @override
  ConsumerState<_FlightPlanApprovalTab> createState() =>
      _FlightPlanApprovalTabState();
}

class _FlightPlanApprovalTabState
    extends ConsumerState<_FlightPlanApprovalTab>
    with AutomaticKeepAliveClientMixin {
  late final PagedList<FlightPlan> _list;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .flightPlans(pageNum: pageNum, pageSize: pageSize, status: 2),
    );
  }

  Future<void> _approve(FlightPlan plan) async {
    final comment = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('批准飞行计划', style: TextStyle(fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              plan.planNo == null
                  ? '计划 ${plan.id.substring(0, 8)}…'
                  : '计划号 ${plan.planNo}',
              style: const TextStyle(fontSize: 13.5),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: comment,
              maxLines: 2,
              decoration: const InputDecoration(hintText: '审批意见（可选）'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('批准'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await ref.read(apiServiceProvider).approveFlightPlan(
              plan.id,
              comment: comment.text.trim().isEmpty
                  ? null
                  : comment.text.trim(),
            );
        if (!mounted) return;
        showAppSnack(context, '已批准，计划号已生成');
        await _list.refresh();
      } on ApiException catch (e) {
        if (mounted) showAppSnack(context, e.message, error: true);
      }
    }
    comment.dispose();
  }

  Future<void> _reject(FlightPlan plan) async {
    final reason = await showPrompt(
      context,
      title: '驳回飞行计划',
      hint: '请填写驳回原因',
      danger: true,
      okText: '驳回',
    );
    if (reason == null) return;
    try {
      await ref
          .read(apiServiceProvider)
          .rejectFlightPlan(plan.id, reason: reason);
      if (!mounted) return;
      showAppSnack(context, '已驳回');
      await _list.refresh();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    }
  }

  Future<void> _showSuggestion(FlightPlan plan) async {
    try {
      final suggestion =
          await ref.read(apiServiceProvider).approvalSuggestion(plan.id);
      if (!mounted) return;
      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('审批建议', style: TextStyle(fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StatusChip(
                suggestion.suggestion == 'Approve' || suggestion.suggestion == '建议批准'
                    ? '建议批准'
                    : suggestion.suggestion,
                tone: AppColors.primary,
              ),
              const SizedBox(height: 10),
              for (final reason in suggestion.reasons)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('· $reason',
                      style: const TextStyle(fontSize: 13, height: 1.5)),
                ),
              if (suggestion.reasons.isEmpty)
                const Text('无风险提示',
                    style: TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('知道了'),
            ),
          ],
        ),
      );
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return PagedListView<FlightPlan>(
      list: _list,
      emptyText: '暂无待审批飞行计划',
      emptyIcon: Icons.fact_check_outlined,
      itemBuilder: (context, plan, index) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      plan.planNo ?? '（待生成计划号）',
                      style: const TextStyle(
                          fontSize: 14.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                  StatusChip(Dict.of(Dict.flightPlanStatusNames, plan.status),
                      compact: true),
                ],
              ),
              const SizedBox(height: 8),
              InfoRow('用途', plan.purpose, dense: true),
              InfoRow('飞行器', plan.droneSerialNo ?? plan.droneId, dense: true),
              if (plan.pilotName != null)
                InfoRow('机长', plan.pilotName!, dense: true),
              InfoRow(
                '时段',
                '${Fmt.dateTime(plan.startAt)} ~ ${Fmt.dateTime(plan.endAt)}',
                dense: true,
              ),
              InfoRow('最大高度', '${Fmt.number(plan.maxAltitudeM)} m', dense: true),
              InfoRow('航点数', '${plan.waypoints.length}', dense: true),
              if (plan.waypoints.isNotEmpty) ...[
                const SizedBox(height: 10),
                AppMap(
                  height: 150,
                  path: plan.waypoints,
                  markers: [
                    if (plan.waypoints.isNotEmpty)
                      MapMarker(
                          lat: plan.waypoints.first.lat,
                          lng: plan.waypoints.first.lng,
                          color: AppColors.success),
                    if (plan.waypoints.length > 1)
                      MapMarker(
                          lat: plan.waypoints.last.lat,
                          lng: plan.waypoints.last.lng,
                          color: AppColors.warning),
                  ],
                  interactive: false,
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  TextButton(
                    onPressed: () => _showSuggestion(plan),
                    child: const Text('审批建议',
                        style: TextStyle(fontSize: 13)),
                  ),
                  const Spacer(),
                  OutlinedButton(
                    onPressed: () => _reject(plan),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: const Text('驳回', style: TextStyle(fontSize: 13)),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: () => _approve(plan),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: const Text('批准', style: TextStyle(fontSize: 13)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UserApprovalTab extends ConsumerStatefulWidget {
  const _UserApprovalTab();

  @override
  ConsumerState<_UserApprovalTab> createState() => _UserApprovalTabState();
}

class _UserApprovalTabState extends ConsumerState<_UserApprovalTab>
    with AutomaticKeepAliveClientMixin {
  late final PagedList<AdminUserItem> _list;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .adminUsers(pageNum: pageNum, pageSize: pageSize, status: 0),
    );
  }

  Future<void> _approve(AdminUserItem user) async {
    final confirmed = await showConfirm(
      context,
      title: '通过审核',
      content: '确认通过 ${user.displayName}（${user.username}）的注册申请？',
    );
    if (!confirmed) return;
    try {
      await ref.read(apiServiceProvider).approveUser(user.id);
      if (!mounted) return;
      showAppSnack(context, '已通过');
      await _list.refresh();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    }
  }

  Future<void> _reject(AdminUserItem user) async {
    final reason = await showPrompt(
      context,
      title: '驳回注册申请',
      hint: '请填写驳回原因（将通知申请人）',
      danger: true,
      okText: '驳回',
    );
    if (reason == null) return;
    try {
      await ref
          .read(apiServiceProvider)
          .rejectUser(user.id, reason: reason);
      if (!mounted) return;
      showAppSnack(context, '已驳回');
      await _list.refresh();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return PagedListView<AdminUserItem>(
      list: _list,
      emptyText: '暂无待审核账号',
      emptyIcon: Icons.how_to_reg_outlined,
      itemBuilder: (context, user, index) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      user.displayName,
                      style: const TextStyle(
                          fontSize: 14.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                  StatusChip(
                      Dict.of(Dict.userTypeNames, user.userType),
                      tone: AppColors.primary,
                      compact: true),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '@${user.username} · ${user.phone}',
                style: const TextStyle(
                    fontSize: 12.5, color: AppColors.textSecondary),
              ),
              if (user.companyName != null) ...[
                const SizedBox(height: 3),
                Text(
                  '企业：${user.companyName}',
                  style: const TextStyle(
                      fontSize: 12.5, color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                '提交时间：${Fmt.dateTime(user.createdAt)}',
                style: const TextStyle(
                    fontSize: 11.5, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () => _reject(user),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: const Text('驳回', style: TextStyle(fontSize: 13)),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: () => _approve(user),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: const Text('通过', style: TextStyle(fontSize: 13)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
