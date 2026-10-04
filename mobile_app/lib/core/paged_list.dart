import 'package:flutter/foundation.dart';

import '../models/models.dart';

/// 服务端分页列表状态（下拉刷新 + 上拉加载）。
class PagedList<T> extends ChangeNotifier {
  PagedList({required this.loader, this.pageSize = 20});

  final Future<Paged<T>> Function(int pageNum, int pageSize) loader;
  final int pageSize;

  final List<T> items = [];
  int total = 0;
  int _pageNum = 0;
  bool loading = false;
  bool loadingMore = false;
  bool ready = false;
  String? error;

  bool get isEmpty => ready && items.isEmpty;
  bool get hasMore => items.length < total;
  bool get showInitialLoading => loading && items.isEmpty;

  Future<void> refresh() async {
    loading = true;
    error = null;
    notifyListeners();
    await _load(1);
  }

  Future<void> loadMore() async {
    if (loading || loadingMore || !hasMore) return;
    loadingMore = true;
    notifyListeners();
    await _load(_pageNum + 1);
  }

  Future<void> _load(int pageNum) async {
    try {
      final page = await loader(pageNum, pageSize);
      _pageNum = pageNum;
      total = page.total;
      if (pageNum == 1) items.clear();
      items.addAll(page.items);
      error = null;
    } catch (e) {
      error = e.toString();
      if (pageNum == 1) items.clear();
    } finally {
      loading = false;
      loadingMore = false;
      ready = true;
      notifyListeners();
    }
  }

  /// 列表内局部更新（如标记已读）。
  void replaceWhere(bool Function(T item) test, T Function(T item) update) {
    var changed = false;
    for (var i = 0; i < items.length; i++) {
      if (test(items[i])) {
        items[i] = update(items[i]);
        changed = true;
      }
    }
    if (changed) notifyListeners();
  }

  void removeWhere(bool Function(T item) test) {
    final before = items.length;
    items.removeWhere(test);
    if (items.length != before) notifyListeners();
  }
}
