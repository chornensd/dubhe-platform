import 'package:flutter/material.dart';

/// 全局主题（与 PC 端一致的蓝色主色与状态色）。
class AppColors {
  AppColors._();

  static const primary = Color(0xFF1677FF);
  static const primaryDark = Color(0xFF0958D9);
  static const background = Color(0xFFF5F7FA);
  static const card = Colors.white;
  static const text = Color(0xFF1F2329);
  static const textSecondary = Color(0xFF8C8C8C);
  static const divider = Color(0xFFEEF0F3);

  static const success = Color(0xFF52C41A);
  static const processing = Color(0xFF1677FF);
  static const warning = Color(0xFFFA8C16);
  static const danger = Color(0xFFF5222D);
  static const neutral = Color(0xFF8C8C8C);

  static const noFly = Color(0xFFF5222D);
  static const restricted = Color(0xFFFA8C16);
  static const tempControl = Color(0xFF722ED1);
  static const fence = Color(0xFF1677FF);

  /// 状态语义色（用于状态标签与仪表）。
  static Color toneOf(String? value) {
    switch (value) {
      case 'Delivered':
      case 'Paid':
      case 'Succeeded':
      case 'Resolved':
      case 'Completed':
      case 'Active':
      case 'Idle':
      case 'Issued':
      case 'Approved':
      case 'Closed':
      case 'Normal':
        return success;
      case 'InFlight':
      case 'Handling':
      case 'Processing':
      case 'InUse':
      case 'Running':
      case 'Settled':
      case 'Confirmed':
        return processing;
      case 'PendingAccept':
      case 'PendingDispatch':
      case 'Pending':
      case 'Submitted':
      case 'Open':
      case 'Draft':
      case 'DueSoon':
      case 'Reported':
      case 'Serious':
      case 'Unpaid':
      case 'Maintenance':
        return warning;
      case 'Cancelled':
      case 'Rejected':
      case 'Frozen':
      case 'Overdue':
      case 'Failed':
      case 'Critical':
      case 'NoFly':
      case 'Refunded':
        return danger;
      case 'Restricted':
      case 'TemporaryControl':
      case 'MerchantFence':
        return tempControl;
      default:
        return neutral;
    }
  }
}

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    primary: AppColors.primary,
    surface: Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.background,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: AppColors.text,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: IconThemeData(color: AppColors.text),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.divider,
      thickness: 1,
      space: 1,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 46),
        side: const BorderSide(color: AppColors.divider),
        foregroundColor: AppColors.text,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.primary),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF7F8FA),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
      ),
      hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      labelStyle: const TextStyle(color: AppColors.textSecondary),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      backgroundColor: const Color(0xFF303030),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.primary.withValues(alpha: 0.12),
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          color: states.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.textSecondary,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w400,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 22,
          color: states.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.textSecondary,
        ),
      ),
    ),
    tabBarTheme: const TabBarThemeData(
      labelColor: AppColors.primary,
      unselectedLabelColor: AppColors.textSecondary,
      indicatorColor: AppColors.primary,
      dividerColor: Colors.transparent,
    ),
    progressIndicatorTheme:
        const ProgressIndicatorThemeData(color: AppColors.primary),
    listTileTheme: const ListTileThemeData(
      iconColor: AppColors.textSecondary,
      textColor: AppColors.text,
    ),
  );
}
