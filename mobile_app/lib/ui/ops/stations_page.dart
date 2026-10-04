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

/// 场站管理：列表 / 地图切换，预约查看与处置。
class OpsStationsPage extends ConsumerStatefulWidget {
  const OpsStationsPage({super.key});

  @override
  ConsumerState<OpsStationsPage> createState() => _OpsStationsPageState();
}

class _OpsStationsPageState extends ConsumerState<OpsStationsPage> {
  bool _mapMode = false;
  late PagedList<Station> _list;

  List<Station> _mapStations = const [];
  bool _mapLoading = false;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .stations(pageNum: pageNum, pageSize: pageSize),
    );
  }

  Future<void> _loadMap() async {
    setState(() => _mapLoading = true);
    try {
      final page = await ref
          .read(apiServiceProvider)
          .stations(pageNum: 1, pageSize: 100);
      if (!mounted) return;
      setState(() {
        _mapStations = page.items;
        _mapLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _mapLoading = false);
        showAppSnack(context, '场站加载失败：$e', error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '场站管理',
      actions: [
        IconButton(
          onPressed: () {
            setState(() => _mapMode = !_mapMode);
            if (_mapMode && _mapStations.isEmpty) _loadMap();
          },
          icon: Icon(
            _mapMode ? Icons.view_list_rounded : Icons.map_outlined,
            size: 22,
          ),
        ),
      ],
      body: _mapMode ? _buildMap() : _buildList(),
    );
  }

  Widget _buildList() {
    return PagedListView<Station>(
      list: _list,
      emptyText: '暂无场站',
      emptyIcon: Icons.ev_station_outlined,
      itemBuilder: (context, station, index) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => StationDetailPage(station: station),
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
                        station.name,
                        style: const TextStyle(
                            fontSize: 14.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                    StatusChip(
                        Dict.of(Dict.stationStatusNames, station.status),
                        compact: true),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined,
                        size: 15, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        station.address,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    StatusChip(Dict.of(Dict.stationTypeNames, station.type),
                        tone: AppColors.primary, compact: true),
                    const SizedBox(width: 8),
                    Text(
                      '容量 ${station.capacity} · 充电桩 ${station.chargerCount}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMap() {
    if (_mapLoading) return const LoadingView(text: '加载场站…');
    if (_mapStations.isEmpty) {
      return EmptyView(
        text: '暂无场站数据',
        icon: Icons.ev_station_outlined,
        action: OutlinedButton(onPressed: _loadMap, child: const Text('刷新')),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        SectionCard(
          title: '场站分布（点击标记查看详情）',
          child: AppMap(
            height: 420,
            markers: [
              for (final station in _mapStations)
                MapMarker(
                  lat: station.lat,
                  lng: station.lng,
                  color: station.status == 'InUse'
                      ? AppColors.warning
                      : AppColors.success,
                  pulse: station.status == 'InUse',
                ),
            ],
            showLegend: false,
          ),
        ),
        SectionCard(
          title: '场站列表',
          child: Column(
            children: [
              for (final station in _mapStations)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.ev_station_outlined, size: 20),
                  title: Text(station.name,
                      style: const TextStyle(fontSize: 14)),
                  subtitle: Text(
                    '${Dict.of(Dict.stationStatusNames, station.status)} · 容量 ${station.capacity}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing:
                      const Icon(Icons.chevron_right_rounded, size: 20),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => StationDetailPage(station: station),
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

/// 场站详情 + 预约处置。
class StationDetailPage extends ConsumerStatefulWidget {
  const StationDetailPage({super.key, required this.station});

  final Station station;

  @override
  ConsumerState<StationDetailPage> createState() => _StationDetailPageState();
}

class _StationDetailPageState extends ConsumerState<StationDetailPage> {
  List<StationReservation> _reservations = const [];
  bool _loading = true;
  String? _error;

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
      final reservations = await ref
          .read(apiServiceProvider)
          .stationReservations(widget.station.id);
      if (!mounted) return;
      setState(() {
        _reservations = reservations;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _cancel(StationReservation reservation) async {
    final confirmed = await showConfirm(
      context,
      title: '取消预约',
      content:
          '时段：${Fmt.dateTime(reservation.startAt)} ~ ${Fmt.dateTime(reservation.endAt)}\n取消后将释放场站容量。',
      okText: '取消预约',
      danger: true,
    );
    if (!confirmed) return;
    try {
      await ref.read(apiServiceProvider).cancelReservation(reservation.id);
      if (!mounted) return;
      showAppSnack(context, '预约已取消');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final station = widget.station;
    return AppScaffold(
      title: '场站详情',
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(14),
          children: [
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          station.name,
                          style: const TextStyle(
                              fontSize: 17, fontWeight: FontWeight.w700),
                        ),
                      ),
                      StatusChip(
                          Dict.of(Dict.stationStatusNames, station.status)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  InfoRow('类型', Dict.of(Dict.stationTypeNames, station.type)),
                  InfoRow('地址', station.address),
                  InfoRow('坐标',
                      '${station.lat.toStringAsFixed(5)}, ${station.lng.toStringAsFixed(5)}'),
                  InfoRow('容量', '${station.capacity}（同时段可预约数）'),
                  InfoRow('充电桩', '${station.chargerCount} 个'),
                  if ((station.remark ?? '').isNotEmpty)
                    InfoRow('备注', station.remark!),
                ],
              ),
            ),
            SectionCard(
              title: '地图位置',
              child: AppMap(
                height: 200,
                markers: [
                  MapMarker(
                    lat: station.lat,
                    lng: station.lng,
                    color: station.status == 'InUse'
                        ? AppColors.warning
                        : AppColors.success,
                    pulse: station.status == 'InUse',
                  ),
                ],
              ),
            ),
            SectionCard(
              title: '预约记录',
              trailing: TextButton(
                onPressed: _load,
                child: const Text('刷新', style: TextStyle(fontSize: 13)),
              ),
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: LoadingView(),
                    )
                  : _error != null
                      ? ErrorView(message: _error!, onRetry: _load)
                      : _reservations.isEmpty
                          ? const Text('暂无预约记录',
                              style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary))
                          : Column(
                              children: [
                                for (final reservation in _reservations)
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 6),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                '${Fmt.dateTime(reservation.startAt)} ~ ${Fmt.time(reservation.endAt)}',
                                                style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight:
                                                        FontWeight.w500),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                '用途：${Dict.of(Dict.reservationPurposeNames, reservation.purpose)}'
                                                '${reservation.orderId == null ? '' : ' · 关联订单'}',
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    color: AppColors
                                                        .textSecondary),
                                              ),
                                            ],
                                          ),
                                        ),
                                        StatusChip(
                                          Dict.of(
                                              Dict.reservationStatusNames,
                                              reservation.status),
                                          compact: true,
                                        ),
                                        if (reservation.status ==
                                            'Reserved') ...[
                                          const SizedBox(width: 4),
                                          TextButton(
                                            onPressed: () =>
                                                _cancel(reservation),
                                            style: TextButton.styleFrom(
                                              foregroundColor:
                                                  AppColors.danger,
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8),
                                              minimumSize: const Size(0, 32),
                                            ),
                                            child: const Text('取消',
                                                style:
                                                    TextStyle(fontSize: 12.5)),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                              ],
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
