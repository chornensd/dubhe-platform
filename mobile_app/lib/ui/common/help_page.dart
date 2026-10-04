import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

class HelpPage extends ConsumerStatefulWidget {
  const HelpPage({super.key});

  @override
  ConsumerState<HelpPage> createState() => _HelpPageState();
}

class _HelpPageState extends ConsumerState<HelpPage> {
  late final PagedList<HelpArticle> _list;
  final _search = TextEditingController();
  String? _category;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref.read(apiServiceProvider).helpArticles(
            pageNum: pageNum,
            pageSize: pageSize,
            keyword: _search.text.trim(),
            category: _category,
          ),
    );
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '帮助中心',
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _list.refresh(),
              decoration: InputDecoration(
                hintText: '搜索帮助文章（关键词）',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  onPressed: _list.refresh,
                ),
              ),
            ),
          ),
          Expanded(
            child: PagedListView<HelpArticle>(
              list: _list,
              emptyText: '未找到相关帮助内容',
              emptyIcon: Icons.menu_book_outlined,
              itemBuilder: (context, item, index) => Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  title: Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w500),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        StatusChip(item.category,
                            tone: AppColors.textSecondary, compact: true),
                        const SizedBox(width: 6),
                        Text(
                          item.contentType == 'Video' ? '视频' : '图文',
                          style: const TextStyle(
                              fontSize: 11.5, color: AppColors.textSecondary),
                        ),
                        const Spacer(),
                        Text(
                          '${item.viewCount} 次浏览',
                          style: const TextStyle(
                              fontSize: 11.5, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  trailing:
                      const Icon(Icons.chevron_right_rounded, size: 20),
                  onTap: () => context.push('/help/${item.id}'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HelpDetailPage extends ConsumerStatefulWidget {
  const HelpDetailPage({super.key, required this.articleId});

  final String articleId;

  @override
  ConsumerState<HelpDetailPage> createState() => _HelpDetailPageState();
}

class _HelpDetailPageState extends ConsumerState<HelpDetailPage> {
  HelpArticle? _article;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final article =
          await ref.read(apiServiceProvider).helpArticle(widget.articleId);
      setState(() {
        _article = article;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '帮助详情',
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      _article!.title,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        StatusChip(_article!.category, compact: true),
                        const SizedBox(width: 8),
                        Text(
                          '更新于 ${Fmt.date(_article!.updatedAt ?? _article!.createdAt)}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (_article!.contentType == 'Video' &&
                        (_article!.videoUrl ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final uri = Uri.tryParse(_article!.videoUrl!);
                            if (uri != null) {
                              await launchUrl(uri,
                                  mode: LaunchMode.externalApplication);
                            }
                          },
                          icon: const Icon(Icons.play_circle_outline_rounded),
                          label: const Text('播放视频教程'),
                        ),
                      ),
                    SelectableText(
                      _article!.content,
                      style: const TextStyle(
                        fontSize: 14.5,
                        height: 1.8,
                        color: AppColors.text,
                      ),
                    ),
                  ],
                ),
    );
  }
}
