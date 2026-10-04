import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/app_map.dart';
import '../widgets/common.dart';
import '../widgets/gauge.dart';

/// 飞行监控：仪表盘 + 轨迹 + 禁限飞区 + 偏航告警（文字 + 语音）。
class PilotMonitoringPage extends ConsumerStatefulWidget {
  const PilotMonitoringPage({super.key, this.orderId});

  final String? orderId;

  @override
  ConsumerState<PilotMonitoringPage> createState() =>
      _PilotMonitoringPageState();
}

class _PilotMonitoringPageState extends ConsumerState<PilotMonitoringPage> {
  final _tts = FlutterTts();

  List<OrderListItem> _orders = const [];
  OrderDetail? _order;
  Drone? _drone;

  String? _selectedOrderId;
  Waypoint? _position;
  final List<Waypoint> _trail = [];
  double _altitude = 60;
  double _speed = 12;
  double _deviationKm = 0;

  bool _loading = true;
  String? _error;
  bool _busy = false;
  bool _autoReport = false;
  bool _voiceAlert = true;
  bool _deviated = false;
  Timer? _autoTimer;
  DateTime? _lastAlertAt;

  static const deviationThresholdKm = 1.0;

  @override
  void initState() {
    super.initState();
    _selectedOrderId = widget.orderId;
    _initTts();
    _load();
  }

  Future<void> _initTts() async {
    try {
      await _tts.setLanguage('zh-CN');
      await _tts.setSpeechRate(0.55);
      await _tts.setVolume(1);
    } catch (_) {
      // 设备不支持 TTS 时静默降级为文字告警
    }
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _tts.stop();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.searchOrders(pageNum: 1, pageSize: 50, status: 'InFlight'),
        api.searchOrders(pageNum: 1, pageSize: 50, status: 'PendingDispatch'),
      ]);
      final orders = [...results[0].items, ...results[1].items];
      if (mounted) setState(() => _orders = orders);

      var orderId = _selectedOrderId ??
          (orders.isNotEmpty ? orders.first.id : null);
      if (orderId != null) {
        final detail = await api.orderDetail(orderId);
        if (!mounted) return;
        setState(() {
          _order = detail;
          _selectedOrderId = orderId;
          _position ??= Waypoint(detail.sender.lat, detail.sender.lng);
          if (detail.plannedRoute.isNotEmpty && _trail.isEmpty) {
            _trail.add(Waypoint(detail.sender.lat, detail.sender.lng));
          }
          _deviationKm = _position == null
              ? 0
              : _distanceToRouteKm(_position!, detail.plannedRoute);
          _loading = false;
        });
        _loadDrone(detail.droneId);
      } else {
        setState(() => _loading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = '$e';
        });
      }
    }
  }

  Future<void> _loadDrone(String? droneId) async {
    if (droneId == null || droneId.isEmpty) return;
    final drones = await ref.read(myDronesProvider.future);
    if (!mounted) return;
    setState(() {
      _drone = drones.where((d) => d.id == droneId).cast<Drone?>().firstWhere(
            (d) => d != null,
            orElse: () => null,
          );
    });
  }

  double _distanceKm(double lat1, double lng1, double lat2, double lng2) {
    final midLat = (lat1 + lat2) / 2 * math.pi / 180;
    final dx = (lng2 - lng1) * 111.32 * math.cos(midLat);
    final dy = (lat2 - lat1) * 111.32;
    return math.sqrt(dx * dx + dy * dy);
  }

  double _distanceToRouteKm(Waypoint point, List<Waypoint> route) {
    if (route.isEmpty) return 0;
    if (route.length == 1) {
      return _distanceKm(point.lat, point.lng, route.first.lat, route.first.lng);
    }
    var best = double.infinity;
    for (var i = 0; i < route.length - 1; i++) {
      final a = route[i];
      final b = route[i + 1];
      final dx = b.lng - a.lng;
      final dy = b.lat - a.lat;
      final lengthSq = dx * dx + dy * dy;
      if (lengthSq == 0) {
        best = math.min(
            best, _distanceKm(point.lat, point.lng, a.lat, a.lng));
        continue;
      }
      final t = (((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) /
              lengthSq)
          .clamp(0.0, 1.0);
      final projLat = a.lat + t * dy;
      final projLng = a.lng + t * dx;
      best = math.min(
          best, _distanceKm(point.lat, point.lng, projLat, projLng));
    }
    return best;
  }

  Future<void> _speak(String text) async {
    if (!_voiceAlert) return;
    try {
      await _tts.stop();
      await _tts.speak(text);
    } catch (_) {
      // 忽略
    }
  }

  void _checkDeviation() {
    final order = _order;
    final position = _position;
    if (order == null || position == null) return;
    final deviation = _distanceToRouteKm(position, order.plannedRoute);
    final exceeded = order.plannedRoute.isNotEmpty &&
        deviation > deviationThresholdKm;
    setState(() {
      _deviationKm = deviation;
      _deviated = exceeded;
    });
    if (exceeded &&
        (_lastAlertAt == null ||
            DateTime.now().difference(_lastAlertAt!) >
                const Duration(seconds: 20))) {
      _lastAlertAt = DateTime.now();
      _speak('注意，已偏离航线，请立即修正');
      if (mounted) showAppSnack(context, '偏航告警：已偏离航线 ${deviation.toStringAsFixed(2)} 公里', error: true);
    }
  }

  Future<void> _reportPosition() async {
    final order = _order;
    final position = _position;
    if (order == null || order.droneId == null || position == null) {
      showAppSnack(context, '当前任务未关联飞行器，无法上报位置', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await ref.read(apiServiceProvider).reportPosition(
            droneId: order.droneId!,
            lat: position.lat,
            lng: position.lng,
            altitudeM: _altitude,
          );
      if (!mounted) return;
      if (result.detectedViolations.isNotEmpty) {
        _speak('检测到违规风险，请立即调整');
        showAppSnack(
          context,
          '位置已上报；检测到 ${result.detectedViolations.length} 条违规：'
          '${result.detectedViolations.map((v) => Dict.of(Dict.violationTypeNames, v.type)).join('、')}',
          error: true,
        );
      } else {
        showAppSnack(context, '位置已上报');
      }
      if (result.distanceToRouteKm != null) {
        setState(() => _deviationKm = result.distanceToRouteKm!);
      }
      _checkDeviation();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _simulateMove() {
    final order = _order;
    final position = _position;
    if (order == null || position == null) return;
    final route = order.plannedRoute;
    if (route.isEmpty) {
      setState(() {
        _position = Waypoint(position.lat + 0.002, position.lng + 0.002);
        _trail.add(_position!);
      });
      _checkDeviation();
      return;
    }
    // 找到最近航线点，向其后的 1-2 个点推进
    var nearest = 0;
    var best = double.infinity;
    for (var i = 0; i < route.length; i++) {
      final d = _distanceKm(position.lat, position.lng, route[i].lat, route[i].lng);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    final target = route[math.min(nearest + 1, route.length - 1)];
    final factor = 0.22;
    final next = Waypoint(
      position.lat + (target.lat - position.lat) * factor,
      position.lng + (target.lng - position.lng) * factor,
    );
    setState(() {
      _position = next;
      _trail.add(next);
      if (_trail.length > 200) _trail.removeAt(0);
      _speed = 10 + math.Random().nextDouble() * 6;
      _altitude = (55 + math.Random().nextDouble() * 20).clamp(20, 120);
    });
    _checkDeviation();
  }

  void _toggleAuto(bool value) {
    setState(() => _autoReport = value);
    _autoTimer?.cancel();
    if (value) {
      _autoTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
        if (!mounted) return;
        _simulateMove();
        await _reportPosition();
      });
    }
  }

  Future<void> _switchOrder(String? orderId) async {
    if (orderId == null) return;
    setState(() {
      _selectedOrderId = orderId;
      _order = null;
      _position = null;
      _trail.clear();
      _deviated = false;
      _deviationKm = 0;
    });
    _toggleAuto(false);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final zones = ref.watch(activeZonesProvider).value ?? const [];
    final order = _order;

    return AppScaffold(
      title: '飞行监控',
      actions: [
        IconButton(
          onPressed: () => context.push('/alerts'),
          icon: const Icon(Icons.warning_amber_rounded, size: 22),
        ),
      ],
      body: _loading
          ? const LoadingView(text: '加载中…')
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 30),
                    children: [
                      if (_orders.isEmpty) ...[
                        SectionCard(
                          child: EmptyView(
                            text: '当前没有待执行 / 执行中的飞行任务',
                            icon: Icons.airplanemode_inactive,
                            action: OutlinedButton(
                              onPressed: _load,
                              child: const Text('刷新'),
                            ),
                          ),
                        ),
                      ] else ...[
                        SectionCard(
                          title: '执行任务',
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedOrderId,
                            items: [
                              for (final order in _orders)
                                DropdownMenuItem(
                                  value: order.id,
                                  child: Text(
                                    '${Dict.of(Dict.orderStatusNames, order.status)} · ${order.orderNo}',
                                    style: const TextStyle(fontSize: 13.5),
                                  ),
                                ),
                            ],
                            onChanged: _switchOrder,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (order != null) ...[
                          if (_deviated) _deviationBanner(order),
                          SectionCard(
                            title: '飞行仪表',
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('语音告警',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                                Switch(
                                  value: _voiceAlert,
                                  onChanged: (value) =>
                                      setState(() => _voiceAlert = value),
                                ),
                              ],
                            ),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceEvenly,
                                  children: [
                                    Gauge(
                                      label: '电量',
                                      value: (_drone?.batteryPercent ?? 0)
                                          .toDouble(),
                                      unit: '%',
                                      max: 100,
                                      color: (_drone?.batteryPercent ?? 0) < 30
                                          ? AppColors.danger
                                          : AppColors.success,
                                    ),
                                    Gauge(
                                      label: '高度',
                                      value: _altitude,
                                      unit: 'm',
                                      max: 150,
                                      color: AppColors.primary,
                                    ),
                                    Gauge(
                                      label: '速度',
                                      value: _speed,
                                      unit: 'm/s',
                                      max: 30,
                                      color: AppColors.tempControl,
                                    ),
                                  ],
                                ),
                                if ((_drone?.batteryPercent ?? 100) < 30)
                                  Container(
                                    margin: const EdgeInsets.only(top: 8),
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: AppColors.danger
                                          .withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.battery_alert_rounded,
                                            size: 18, color: AppColors.danger),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            '电量低于 30%（${_drone?.batteryPercent}%），请尽快返航或前往换电站',
                                            style: const TextStyle(
                                                fontSize: 12.5,
                                                color: AppColors.danger),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                if (_drone != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: InfoRow(
                                      '飞行器',
                                      '${_drone!.serialNo} · ${_drone!.model}',
                                      dense: true,
                                    ),
                                  ),
                                InfoRow(
                                  '距航线偏差',
                                  order.plannedRoute.isEmpty
                                      ? '无航线数据'
                                      : '${_deviationKm.toStringAsFixed(2)} 公里'
                                          '（阈值 ${deviationThresholdKm.toStringAsFixed(1)} 公里）',
                                  dense: true,
                                  valueColor: _deviated
                                      ? AppColors.danger
                                      : AppColors.success,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          SectionCard(
                            title: '航迹与空域',
                            child: Column(
                              children: [
                                AppMap(
                                  height: 260,
                                  zones: zones,
                                  path: order.plannedRoute,
                                  trail: _trail,
                                  markers: [
                                    MapMarker(
                                      lat: order.sender.lat,
                                      lng: order.sender.lng,
                                      color: AppColors.success,
                                    ),
                                    MapMarker(
                                      lat: order.receiver.lat,
                                      lng: order.receiver.lng,
                                      color: AppColors.warning,
                                    ),
                                    if (_position != null)
                                      MapMarker(
                                        lat: _position!.lat,
                                        lng: _position!.lng,
                                        color: AppColors.danger,
                                        pulse: true,
                                      ),
                                  ],
                                  showLegend: true,
                                ),
                                const SizedBox(height: 8),
                                if (_position != null)
                                  Text(
                                    '当前位置：${_position!.lat.toStringAsFixed(5)}, ${_position!.lng.toStringAsFixed(5)} · 轨迹点 ${_trail.length}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          SectionCard(
                            title: '位置上报',
                            child: Column(
                              children: [
                                SwitchListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: const Text('自动上报（模拟移动）',
                                      style: TextStyle(fontSize: 14)),
                                  subtitle: const Text(
                                    '每 5 秒沿航线推进并上报位置，触发偏航/闯入检测',
                                    style: TextStyle(fontSize: 11.5),
                                  ),
                                  value: _autoReport,
                                  onChanged: _toggleAuto,
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: _busy ? null : _simulateMove,
                                        icon:
                                            const Icon(Icons.navigation_outlined,
                                                size: 18),
                                        label: const Text('模拟移动'),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: FilledButton.icon(
                                        onPressed:
                                            _busy ? null : _reportPosition,
                                        icon: const Icon(Icons.upload_rounded,
                                            size: 18),
                                        label: const Text('上报位置'),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: TextButton(
                                    onPressed: () => setState(() {
                                      _trail.clear();
                                      if (_position != null) {
                                        _trail.add(_position!);
                                      }
                                    }),
                                    child: const Text('清空本地轨迹',
                                        style: TextStyle(fontSize: 12.5)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          SectionCard(
                            title: '快捷操作',
                            child: Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => context.push(
                                        '/faults/new?droneId=${order.droneId ?? ''}'),
                                    icon: const Icon(Icons.build_outlined,
                                        size: 18),
                                    label: const Text('故障上报'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => context
                                        .push('/orders/${order.id}'),
                                    icon: const Icon(
                                        Icons.receipt_long_outlined,
                                        size: 18),
                                    label: const Text('任务详情'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _deviationBanner(OrderDetail order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: AppColors.danger, size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '偏航告警',
                  style: TextStyle(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '偏离申报航线 ${_deviationKm.toStringAsFixed(2)} 公里，请立即修正航向',
                  style: const TextStyle(fontSize: 12.5, height: 1.5),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _speak('注意，已偏离航线，请立即修正'),
            child: const Text('播报', style: TextStyle(fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
