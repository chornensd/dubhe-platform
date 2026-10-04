import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../theme.dart';

class MapMarker {
  const MapMarker({
    required this.lat,
    required this.lng,
    this.label,
    this.color,
    this.icon,
    this.pulse = false,
  });

  final double lat;
  final double lng;
  final String? label;
  final Color? color;
  final IconData? icon;
  final bool pulse;
}

/// 经纬度投影（等距圆柱 + 中心纬度 cos 修正，与 PC 端自绘地图一致）。
class MapProjection {
  MapProjection({
    required this.minLat,
    required this.maxLat,
    required this.minLng,
    required this.maxLng,
    required this.size,
  }) {
    final latSpan = math.max(maxLat - minLat, 1e-6);
    final lngSpan = math.max((maxLng - minLng) * _cosFactor, 1e-6);
    final padX = size.width * 0.08;
    final padY = size.height * 0.08;
    _scale = math.min(
      (size.width - padX * 2) / lngSpan,
      (size.height - padY * 2) / latSpan,
    );
    _offsetX = (size.width - lngSpan * _scale) / 2;
    _offsetY = (size.height - latSpan * _scale) / 2;
  }

  final double minLat;
  final double maxLat;
  final double minLng;
  final double maxLng;
  final Size size;

  double _scale = 1;
  double _offsetX = 0;
  double _offsetY = 0;

  double get _cosFactor =>
      math.cos(((minLat + maxLat) / 2) * math.pi / 180).abs().clamp(0.2, 1.0);

  Offset toOffset(double lat, double lng) {
    final x = (lng - minLng) * _cosFactor * _scale + _offsetX;
    final y = (maxLat - lat) * _scale + _offsetY;
    return Offset(x, y);
  }

  Waypoint toLatLng(Offset offset) {
    final lng = (offset.dx - _offsetX) / (_scale * _cosFactor) + minLng;
    final lat = maxLat - (offset.dy - _offsetY) / _scale;
    return Waypoint(lat, lng);
  }

  /// 半径（km）对应的像素长度。
  double radiusPx(double radiusKm) {
    final latDelta = radiusKm / 111.32;
    return latDelta * _scale;
  }
}

/// 空域/轨迹/标记地图（自绘，无需第三方 Key）。
class AppMap extends StatefulWidget {
  const AppMap({
    super.key,
    this.zones = const [],
    this.serviceAreas = const [],
    this.path = const [],
    this.trail = const [],
    this.markers = const [],
    this.defaultCenter,
    this.pickable = false,
    this.onPick,
    this.height = 240,
    this.showLegend = false,
    this.interactive = true,
  });

  final List<AirspaceZone> zones;
  final List<ServiceArea> serviceAreas;
  final List<Waypoint> path;
  final List<Waypoint> trail;
  final List<MapMarker> markers;
  final Waypoint? defaultCenter;
  final bool pickable;
  final ValueChanged<Waypoint>? onPick;
  final double height;
  final bool showLegend;
  final bool interactive;

  @override
  State<AppMap> createState() => _AppMapState();
}

class _AppMapState extends State<AppMap> {
  final _transformation = TransformationController();

  @override
  void dispose() {
    _transformation.dispose();
    super.dispose();
  }

  List<Waypoint> get _points {
    final points = <Waypoint>[];
    for (final zone in widget.zones) {
      final dLat = zone.radiusKm / 111.32;
      final dLng = zone.radiusKm / (111.32 * 0.8);
      points.addAll([
        Waypoint(zone.centerLat - dLat, zone.centerLng - dLng),
        Waypoint(zone.centerLat + dLat, zone.centerLng + dLng),
      ]);
    }
    for (final area in widget.serviceAreas) {
      final dLat = area.radiusKm / 111.32;
      final dLng = area.radiusKm / (111.32 * 0.8);
      points.addAll([
        Waypoint(area.centerLat - dLat, area.centerLng - dLng),
        Waypoint(area.centerLat + dLat, area.centerLng + dLng),
      ]);
    }
    points.addAll(widget.path);
    points.addAll(widget.trail);
    for (final marker in widget.markers) {
      points.add(Waypoint(marker.lat, marker.lng));
    }
    if (widget.defaultCenter != null) points.add(widget.defaultCenter!);
    return points;
  }

  @override
  Widget build(BuildContext context) {
    final points = _points;
    final center = widget.defaultCenter ??
        (points.isEmpty
            ? const Waypoint(30.2741, 120.1551)
            : Waypoint(
                points.map((p) => p.lat).reduce((a, b) => a + b) / points.length,
                points.map((p) => p.lng).reduce((a, b) => a + b) / points.length,
              ));

    var minLat = center.lat - 0.01;
    var maxLat = center.lat + 0.01;
    var minLng = center.lng - 0.01;
    var maxLng = center.lng + 0.01;
    for (final point in points) {
      minLat = math.min(minLat, point.lat);
      maxLat = math.max(maxLat, point.lat);
      minLng = math.min(minLng, point.lng);
      maxLng = math.max(maxLng, point.lng);
    }
    // 保底跨度，避免单点地图比例失真
    if (maxLat - minLat < 0.004) {
      minLat -= 0.002;
      maxLat += 0.002;
    }
    if (maxLng - minLng < 0.004) {
      minLng -= 0.002;
      maxLng += 0.002;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: widget.height,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final size = Size(constraints.maxWidth, constraints.maxHeight);
                final projection = MapProjection(
                  minLat: minLat,
                  maxLat: maxLat,
                  minLng: minLng,
                  maxLng: maxLng,
                  size: size,
                );
                final painter = _MapPainter(
                  projection: projection,
                  zones: widget.zones,
                  serviceAreas: widget.serviceAreas,
                  path: widget.path,
                  trail: widget.trail,
                  markers: widget.markers,
                );

                final child = CustomPaint(size: size, painter: painter);

                if (!widget.interactive && !widget.pickable) {
                  return child;
                }

                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapUp: widget.pickable
                      ? (details) {
                          final scene = _transformation.toScene(details.localPosition);
                          widget.onPick?.call(projection.toLatLng(scene));
                        }
                      : null,
                  child: InteractiveViewer(
                    transformationController: _transformation,
                    minScale: 0.8,
                    maxScale: 6,
                    scaleEnabled: widget.interactive,
                    panEnabled: widget.interactive,
                    child: child,
                  ),
                );
              },
            ),
          ),
        ),
        if (widget.showLegend)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(
              spacing: 14,
              runSpacing: 6,
              children: const [
                _LegendDot(color: AppColors.noFly, label: '禁飞区'),
                _LegendDot(color: AppColors.restricted, label: '限飞区'),
                _LegendDot(color: AppColors.tempControl, label: '临时管制'),
                _LegendDot(color: AppColors.fence, label: '电子围栏'),
                _LegendDot(color: AppColors.primary, label: '航线'),
                _LegendDot(color: AppColors.success, label: '轨迹'),
              ],
            ),
          ),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _MapPainter extends CustomPainter {
  _MapPainter({
    required this.projection,
    required this.zones,
    required this.serviceAreas,
    required this.path,
    required this.trail,
    required this.markers,
  });

  final MapProjection projection;
  final List<AirspaceZone> zones;
  final List<ServiceArea> serviceAreas;
  final List<Waypoint> path;
  final List<Waypoint> trail;
  final List<MapMarker> markers;

  @override
  void paint(Canvas canvas, Size size) {
    // 背景
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFFF0F4F8),
    );

    _drawGrid(canvas, size);

    for (final area in serviceAreas) {
      _drawCircle(
        canvas,
        area.centerLat,
        area.centerLng,
        area.radiusKm,
        const Color(0xFF13C2C2),
      );
    }

    for (final zone in zones) {
      if (!zone.isActive) continue;
      final color = switch (zone.type) {
        'NoFly' => AppColors.noFly,
        'Restricted' => AppColors.restricted,
        'TemporaryControl' => AppColors.tempControl,
        _ => AppColors.fence,
      };
      _drawCircle(canvas, zone.centerLat, zone.centerLng, zone.radiusKm, color);
    }

    if (trail.length >= 2) {
      _drawPolyline(canvas, trail, AppColors.success, width: 2.4);
    }
    if (path.length >= 2) {
      _drawPolyline(canvas, path, AppColors.primary, width: 2.4, dashed: true);
    }
    if (path.length == 1) {
      _drawDot(canvas, path.first, AppColors.primary, 4);
    }

    for (final marker in markers) {
      _drawMarker(canvas, marker);
    }
  }

  void _drawGrid(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x14000000)
      ..strokeWidth = 0.6;
    for (var i = 1; i < 4; i++) {
      final x = size.width * i / 4;
      final y = size.height * i / 4;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  void _drawCircle(
    Canvas canvas,
    double lat,
    double lng,
    double radiusKm,
    Color color,
  ) {
    final center = projection.toOffset(lat, lng);
    final radius = projection.radiusPx(radiusKm);
    canvas.drawCircle(
      center,
      radius,
      Paint()..color = color.withValues(alpha: 0.12),
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = color.withValues(alpha: 0.8),
    );
  }

  void _drawPolyline(
    Canvas canvas,
    List<Waypoint> points,
    Color color, {
    double width = 2,
    bool dashed = false,
  }) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = width
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    if (!dashed) {
      final path = Path();
      for (var i = 0; i < points.length; i++) {
        final offset = projection.toOffset(points[i].lat, points[i].lng);
        if (i == 0) {
          path.moveTo(offset.dx, offset.dy);
        } else {
          path.lineTo(offset.dx, offset.dy);
        }
      }
      canvas.drawPath(path, paint);
      for (final point in points) {
        _drawDot(canvas, point, color, 3);
      }
      return;
    }

    for (var i = 0; i < points.length - 1; i++) {
      final a = projection.toOffset(points[i].lat, points[i].lng);
      final b = projection.toOffset(points[i + 1].lat, points[i + 1].lng);
      _drawDashedLine(canvas, a, b, paint);
    }
    for (final point in points) {
      _drawDot(canvas, point, color, 3);
    }
  }

  void _drawDashedLine(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dash = 6.0;
    const gap = 4.0;
    final total = (b - a).distance;
    if (total == 0) return;
    final direction = (b - a) / total;
    var travelled = 0.0;
    while (travelled < total) {
      final start = a + direction * travelled;
      final end = a + direction * math.min(travelled + dash, total);
      canvas.drawLine(start, end, paint);
      travelled += dash + gap;
    }
  }

  void _drawDot(Canvas canvas, Waypoint point, Color color, double radius) {
    canvas.drawCircle(
      projection.toOffset(point.lat, point.lng),
      radius,
      Paint()..color = color,
    );
  }

  void _drawMarker(Canvas canvas, MapMarker marker) {
    final center = projection.toOffset(marker.lat, marker.lng);
    final color = marker.color ?? AppColors.primary;
    if (marker.pulse) {
      canvas.drawCircle(
        center,
        13,
        Paint()..color = color.withValues(alpha: 0.18),
      );
    }
    canvas.drawCircle(
      center,
      6,
      Paint()
        ..color = color
        ..style = PaintingStyle.fill,
    );
    canvas.drawCircle(
      center,
      6,
      Paint()
        ..color = Colors.white
        ..strokeWidth = 1.6
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(covariant _MapPainter oldDelegate) => true;
}
