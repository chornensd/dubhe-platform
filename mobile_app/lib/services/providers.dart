import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/session.dart';
import '../models/models.dart';
import 'api_service.dart';

/// 未读消息数（顶栏角标）。
final unreadCountProvider = FutureProvider<int>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return 0;
  final page = await ref
      .read(apiServiceProvider)
      .notifications(pageNum: 1, pageSize: 1, unreadOnly: true);
  return page.total;
});

/// 生效中的空域/围栏（地图展示）。
final activeZonesProvider = FutureProvider<List<AirspaceZone>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return const [];
  final page = await ref
      .read(apiServiceProvider)
      .zones(pageNum: 1, pageSize: 100, activeOnly: true);
  return page.items;
});

/// 机长可访问的飞行器（后端按机长订单范围裁剪）。
final myDronesProvider = FutureProvider<List<Drone>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return const [];
  final page = await ref
      .read(apiServiceProvider)
      .drones(pageNum: 1, pageSize: 100);
  return page.items;
});

/// 客户可选商家。
final merchantsProvider = FutureProvider<List<MerchantOption>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return const [];
  return ref.read(apiServiceProvider).availableMerchants();
});
