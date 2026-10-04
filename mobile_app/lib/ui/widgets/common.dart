import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/paged_list.dart';
import '../theme.dart';

/// 状态标签（按语义着色）。
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.tone, this.compact = false});

  final String label;
  final Color? tone;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final color = tone ?? AppColors.toneOf(label);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 1 : 3,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: compact ? 11 : 12,
          fontWeight: FontWeight.w500,
          height: 1.3,
        ),
      ),
    );
  }
}

/// 白底卡片区块。
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    this.title,
    this.trailing,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.margin = const EdgeInsets.only(bottom: 12),
  });

  final String? title;
  final Widget? trailing;
  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 3,
                    height: 14,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      title!,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
          child,
        ],
      ),
    );
  }
}

/// 键值行。
class InfoRow extends StatelessWidget {
  const InfoRow(
    this.label,
    this.value, {
    super.key,
    this.valueColor,
    this.valueWidget,
    this.dense = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final Widget? valueWidget;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: dense ? 4 : 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: valueWidget ??
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor ?? AppColors.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
          ),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.text});

  final String? text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 2.6),
          ),
          if (text != null) ...[
            const SizedBox(height: 12),
            Text(
              text!,
              style:
                  const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    this.text = '暂无数据',
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  final String text;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 52, color: const Color(0xFFD9D9D9)),
            const SizedBox(height: 12),
            Text(
              text,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined,
                size: 52, color: Color(0xFFD9D9D9)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onRetry, child: const Text('重试')),
            ],
          ],
        ),
      ),
    );
  }
}

/// 分页列表（下拉刷新 + 上拉加载 + 空态/错误态）。
class PagedListView<T> extends StatefulWidget {
  const PagedListView({
    super.key,
    required this.list,
    required this.itemBuilder,
    this.padding = const EdgeInsets.fromLTRB(12, 12, 12, 24),
    this.emptyText = '暂无数据',
    this.emptyIcon = Icons.inbox_outlined,
    this.header,
    this.itemSpacing = 10,
    this.autoLoad = true,
  });

  final PagedList<T> list;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final EdgeInsets padding;
  final String emptyText;
  final IconData emptyIcon;
  final Widget? header;
  final double itemSpacing;
  final bool autoLoad;

  @override
  State<PagedListView<T>> createState() => _PagedListViewState<T>();
}

class _PagedListViewState<T> extends State<PagedListView<T>> {
  final _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
    if (widget.autoLoad && !widget.list.ready && !widget.list.loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.list.refresh();
      });
    }
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final position = _controller.position;
    if (position.pixels + 240 >= position.maxScrollExtent) {
      widget.list.loadMore();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.list,
      builder: (context, _) {
        final list = widget.list;

        if (!list.ready && list.loading) {
          return const LoadingView(text: '加载中…');
        }
        if (list.items.isEmpty && list.error != null) {
          return ErrorView(
            message: list.error!,
            onRetry: () => list.refresh(),
          );
        }
        if (list.items.isEmpty) {
          return RefreshIndicator(
            onRefresh: list.refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.5,
                  child: EmptyView(text: widget.emptyText, icon: widget.emptyIcon),
                ),
              ],
            ),
          );
        }

        final headerCount = widget.header != null ? 1 : 0;
        final itemCount = list.items.length +
            headerCount +
            (list.hasMore || list.loadingMore ? 1 : 0);

        return RefreshIndicator(
          onRefresh: list.refresh,
          child: ListView.separated(
            controller: _controller,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: widget.padding,
            itemCount: itemCount,
            separatorBuilder: (context, index) => SizedBox(
              height: (widget.header != null && index == 0)
                  ? 12
                  : widget.itemSpacing,
            ),
            itemBuilder: (context, index) {
              if (widget.header != null && index == 0) {
                return widget.header!;
              }
              final itemIndex = index - headerCount;
              if (itemIndex >= list.items.length) {
                WidgetsBinding.instance
                    .addPostFrameCallback((_) => widget.list.loadMore());
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                );
              }
              return widget.itemBuilder(context, list.items[itemIndex], itemIndex);
            },
          ),
        );
      },
    );
  }
}

/// Riverpod AsyncValue 通用渲染。
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.builder,
    this.onRetry,
    this.loadingText,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;
  final String? loadingText;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => LoadingView(text: loadingText),
      error: (error, _) => ErrorView(message: '$error', onRetry: onRetry),
      data: builder,
    );
  }
}

/// 评分显示。
class StarRating extends StatelessWidget {
  const StarRating({super.key, required this.value, this.size = 16});

  final int value;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          i < value ? Icons.star_rounded : Icons.star_outline_rounded,
          size: size,
          color: const Color(0xFFFAAD14),
        ),
      ),
    );
  }
}

/// 评分输入。
class StarInput extends StatelessWidget {
  const StarInput({
    super.key,
    required this.value,
    required this.onChanged,
    this.size = 34,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        5,
        (i) => IconButton(
          onPressed: () => onChanged(i + 1),
          iconSize: size,
          color: const Color(0xFFFAAD14),
          icon: Icon(
            i < value ? Icons.star_rounded : Icons.star_outline_rounded,
          ),
        ),
      ),
    );
  }
}

class TimelineEntry {
  const TimelineEntry({
    required this.title,
    this.subtitle,
    this.time,
    this.color,
    this.icon,
  });

  final String title;
  final String? subtitle;
  final String? time;
  final Color? color;
  final IconData? icon;
}

/// 纵向时间线。
class TimelineView extends StatelessWidget {
  const TimelineView({super.key, required this.entries});

  final List<TimelineEntry> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const Text(
        '暂无记录',
        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < entries.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 22,
                  child: Column(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        margin: const EdgeInsets.only(top: 4),
                        decoration: BoxDecoration(
                          color: entries[i].color ?? AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      if (i != entries.length - 1)
                        Expanded(
                          child: Container(
                            width: 1.5,
                            margin: const EdgeInsets.symmetric(vertical: 2),
                            color: AppColors.divider,
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                entries[i].title,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.text,
                                ),
                              ),
                            ),
                            if (entries[i].time != null)
                              Text(
                                entries[i].time!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                          ],
                        ),
                        if (entries[i].subtitle != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              entries[i].subtitle!,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.textSecondary,
                                height: 1.5,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// 数据指标块（工作台/看板）。
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    this.unit,
    this.color,
    this.onTap,
  });

  final String label;
  final String value;
  final String? unit;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12.5,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
                    color: color ?? AppColors.text,
                  ),
                ),
                if (unit != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 3),
                    child: Text(
                      unit!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 快捷入口（图标 + 文字）。
class QuickEntry extends StatelessWidget {
  const QuickEntry({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.badge,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? AppColors.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: tone, size: 23),
                ),
                if (badge != null && badge! > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.danger,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge! > 99 ? '99+' : '$badge',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              label,
              style: const TextStyle(fontSize: 12.5, color: AppColors.text),
            ),
          ],
        ),
      ),
    );
  }
}

/// 通用消息提示。
void showAppSnack(BuildContext context, String message, {bool error = false}) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? const Color(0xFFB42318) : null,
        duration: const Duration(seconds: 2),
      ),
    );
}

/// 二次确认。
Future<bool> showConfirm(
  BuildContext context, {
  required String title,
  String? content,
  String okText = '确定',
  bool danger = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 16)),
      content: content == null
          ? null
          : Text(content, style: const TextStyle(fontSize: 14)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('取消'),
        ),
        FilledButton(
          style: danger
              ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
              : null,
          onPressed: () => Navigator.pop(context, true),
          child: Text(okText),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// 必填原因输入弹窗（驳回/拒单/取消等）。
Future<String?> showPrompt(
  BuildContext context, {
  required String title,
  String? hint,
  String okText = '提交',
  bool danger = false,
  int maxLines = 3,
}) async {
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 16)),
      content: TextField(
        controller: controller,
        maxLines: maxLines,
        autofocus: true,
        decoration: InputDecoration(hintText: hint ?? '请输入原因'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          style: danger
              ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
              : null,
          onPressed: () {
            final text = controller.text.trim();
            if (text.isEmpty) {
              showAppSnack(context, '请填写内容', error: true);
              return;
            }
            Navigator.pop(context, text);
          },
          child: Text(okText),
        ),
      ],
    ),
  );
  controller.dispose();
  return result;
}

/// 日期时间选择（先日期后时间）。
Future<DateTime?> pickDateTime(
  BuildContext context, {
  DateTime? initial,
  DateTime? first,
  DateTime? last,
}) async {
  final now = DateTime.now();
  final base = initial ?? now;
  final date = await showDatePicker(
    context: context,
    initialDate: base,
    firstDate: first ?? now.subtract(const Duration(days: 1)),
    lastDate: last ?? now.add(const Duration(days: 365)),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    initialTime: TimeOfDay.fromDateTime(base),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

/// 页面骨架。
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    this.title,
    required this.body,
    this.actions,
    this.leading,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.backgroundColor,
    this.resizeToAvoidBottomInset = true,
  });

  final String? title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? leading;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final Color? backgroundColor;
  final bool resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: title == null
          ? null
          : AppBar(title: Text(title!), actions: actions, leading: leading),
      body: body,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
    );
  }
}
