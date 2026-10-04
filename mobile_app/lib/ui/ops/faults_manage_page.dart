import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../core/permissions.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../pilot/faults_page.dart';

/// 故障处理列表（运维/管理员/商家）。
class OpsFaultsPage extends ConsumerStatefulWidget {
  const OpsFaultsPage({super.key});

  @override
  ConsumerState<OpsFaultsPage> createState() => _OpsFaultsPageState();
}

class _OpsFaultsPageState extends ConsumerState<OpsFaultsPage> {
  static const _statuses = <(int?, String)>[
    (null, '全部'),
    (1, '已上报'),
    (2, '处理中'),
    (3, '已解决'),
  ];

  int? _status;
  late PagedList<FaultItem> _list;

  @override
  void initState() {
    super.initState();
    _list = _createList();
  }

  PagedList<FaultItem> _createList() {
    final status = _status;
    return PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .faults(pageNum: pageNum, pageSize: pageSize, status: status),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '故障处理',
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: SizedBox(
              height: 34,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                scrollDirection: Axis.horizontal,
                itemCount: _statuses.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final item = _statuses[index];
                  final selected = _status == item.$1;
                  return GestureDetector(
                    onTap: () => setState(() {
                      _status = item.$1;
                      _list = _createList();
                    }),
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.primary
                            : const Color(0xFFF3F5F7),
                        borderRadius: BorderRadius.circular(17),
                      ),
                      child: Text(
                        item.$2,
                        style: TextStyle(
                          fontSize: 13,
                          color: selected ? Colors.white : AppColors.text,
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          Expanded(
            child: PagedListView<FaultItem>(
              key: ValueKey(_status),
              list: _list,
              emptyText: '暂无故障记录',
              emptyIcon: Icons.build_outlined,
              itemBuilder: (context, fault, index) => _FaultCard(
                fault: fault,
                onChanged: _list.refresh,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FaultCard extends ConsumerStatefulWidget {
  const _FaultCard({required this.fault, required this.onChanged});

  final FaultItem fault;
  final VoidCallback onChanged;

  @override
  ConsumerState<_FaultCard> createState() => _FaultCardState();
}

class _FaultCardState extends ConsumerState<_FaultCard> {
  bool _busy = false;

  Future<void> _resolve() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('故障处理完成', style: TextStyle(fontSize: 16)),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
              hintText: '处理结果（将写入维保记录，并恢复飞行器健康分）'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确认完成'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      if (controller.text.trim().length < 2) {
        if (mounted) showAppSnack(context, '请填写处理结果', error: true);
      } else {
        setState(() => _busy = true);
        try {
          await ref.read(apiServiceProvider).resolveFault(
                widget.fault.id,
                resolution: controller.text.trim(),
              );
          if (!mounted) return;
          showAppSnack(context, '故障已闭环');
          widget.onChanged();
        } on ApiException catch (e) {
          if (mounted) showAppSnack(context, e.message, error: true);
        } finally {
          if (mounted) setState(() => _busy = false);
        }
      }
    }
    controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fault = widget.fault;
    final user = ref.watch(currentUserProvider);
    final canManage = user?.can('resource.fault.manage') ?? false;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => FaultDetailPage(faultId: fault.id),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      fault.faultType,
                      style: const TextStyle(
                          fontSize: 14.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                  StatusChip(Dict.of(Dict.faultStatusNames, fault.status),
                      compact: true),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                fault.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    height: 1.5),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    '飞行器 ${fault.droneId.substring(0, 8)}…',
                    style: const TextStyle(
                        fontSize: 11.5, color: AppColors.textSecondary),
                  ),
                  const Spacer(),
                  Text(
                    Fmt.monthDay(fault.reportedAt),
                    style: const TextStyle(
                        fontSize: 11.5, color: AppColors.textSecondary),
                  ),
                ],
              ),
              if (canManage && fault.status != 'Resolved') ...[
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(
                    onPressed: _busy ? null : _resolve,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 36),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    child: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('处理完成',
                            style: TextStyle(fontSize: 13)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
