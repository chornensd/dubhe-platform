import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// 仪表盘（电量/高度/速度等）。
class Gauge extends StatelessWidget {
  const Gauge({
    super.key,
    required this.label,
    required this.value,
    required this.unit,
    this.min = 0,
    this.max = 100,
    this.color,
    this.size = 96,
    this.decimals = 0,
  });

  final String label;
  final double value;
  final String unit;
  final double min;
  final double max;
  final Color? color;
  final double size;
  final int decimals;

  @override
  Widget build(BuildContext context) {
    final ratio = ((value - min) / (max - min)).clamp(0.0, 1.0);
    final tone = color ?? AppColors.toneOf(ratio < 0.3 ? 'Critical' : 'Normal');
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: size,
          height: size * 0.78,
          child: CustomPaint(
            painter: _GaugePainter(ratio: ratio, color: tone),
            child: Center(
              child: Padding(
                padding: EdgeInsets.only(top: size * 0.22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      decimals == 0
                          ? value.toStringAsFixed(0)
                          : value.toStringAsFixed(decimals),
                      style: TextStyle(
                        fontSize: size * 0.22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                    ),
                    Text(
                      unit,
                      style: TextStyle(
                        fontSize: size * 0.11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.ratio, required this.color});

  final double ratio;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const startAngle = math.pi * 0.75;
    const sweepAngle = math.pi * 1.5;
    final center = Offset(size.width / 2, size.height * 0.78);
    final radius = math.min(size.width / 2, size.height * 0.78) - 7;
    final rect = Rect.fromCircle(center: center, radius: radius);

    canvas.drawArc(
      rect,
      startAngle,
      sweepAngle,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round
        ..color = const Color(0xFFEDEFF2),
    );
    canvas.drawArc(
      rect,
      startAngle,
      sweepAngle * ratio,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _GaugePainter oldDelegate) =>
      oldDelegate.ratio != ratio || oldDelegate.color != color;
}

/// 水平进度条（电量小条等）。
class ProgressLine extends StatelessWidget {
  const ProgressLine({
    super.key,
    required this.value,
    this.color,
    this.height = 6,
  });

  final double value;
  final Color? color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final ratio = value.clamp(0.0, 1.0);
    final tone = color ?? AppColors.primary;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: LinearProgressIndicator(
        value: ratio,
        minHeight: height,
        backgroundColor: const Color(0xFFEDEFF2),
        valueColor: AlwaysStoppedAnimation(tone),
      ),
    );
  }
}
