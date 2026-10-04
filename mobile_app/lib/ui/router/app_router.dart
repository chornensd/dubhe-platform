import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/permissions.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../admin/admin_workbench_page.dart';
import '../admin/approvals_page.dart';
import '../customer/home_page.dart';
import '../customer/invoices_page.dart';
import '../customer/order_create_page.dart';
import '../customer/order_detail_page.dart';
import '../customer/orders_page.dart';
import '../customer/tickets_page.dart';
import '../common/help_page.dart';
import '../common/notifications_page.dart';
import '../common/profile_page.dart';
import '../common/simple_workbench.dart';
import '../auth/login_page.dart';
import '../auth/register_page.dart';
import '../auth/server_settings.dart';
import '../pilot/alerts_page.dart';
import '../pilot/faults_page.dart';
import '../pilot/monitoring_page.dart';
import '../pilot/records_page.dart';
import '../pilot/workbench_page.dart';
import '../ops/drones_page.dart';
import '../ops/faults_manage_page.dart';
import '../ops/maintenance_page.dart';
import '../ops/ops_workbench_page.dart';
import '../ops/stations_page.dart';
import '../shell/main_shell.dart';
import '../theme.dart';

/// 应用路由（go_router）。
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefreshNotifier(ref);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final user = authState.value;
      final location = state.matchedLocation;
      final isAuthRoute = location == '/login' || location == '/register';

      if (authState.isLoading && !authState.hasValue) {
        return location == '/splash' ? null : '/splash';
      }
      if (user == null) {
        return isAuthRoute ? null : '/login';
      }
      if (isAuthRoute || location == '/splash') {
        return _homeFor(user);
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const _SplashPage(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
          path: '/register', builder: (context, state) => const RegisterPage()),
      ShellRoute(
        builder: (context, state, child) => MainShell(
          location: state.uri.path,
          child: child,
        ),
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const CustomerHomePage(),
          ),
          GoRoute(
            path: '/orders',
            builder: (context, state) => CustomerOrdersPage(
              initialStatus: state.uri.queryParameters['status'],
              initialKeyword: state.uri.queryParameters['keyword'],
            ),
          ),
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const NotificationsPage(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfilePage(),
          ),
          GoRoute(
            path: '/workbench',
            builder: (context, state) => const _RoleWorkbench(),
          ),
          GoRoute(
            path: '/ops/workbench',
            builder: (context, state) => const OpsWorkbenchPage(),
          ),
          GoRoute(
            path: '/ops/drones',
            builder: (context, state) => const OpsDronesPage(),
          ),
          GoRoute(
            path: '/ops/stations',
            builder: (context, state) => const OpsStationsPage(),
          ),
          GoRoute(
            path: '/admin/workbench',
            builder: (context, state) => const AdminWorkbenchPage(),
          ),
          GoRoute(
            path: '/admin/approvals',
            builder: (context, state) => const AdminApprovalsPage(),
          ),
          GoRoute(
            path: '/monitoring',
            builder: (context, state) => PilotMonitoringPage(
              orderId: state.uri.queryParameters['orderId'],
            ),
          ),
          GoRoute(
            path: '/records',
            builder: (context, state) => const PilotRecordsPage(),
          ),
        ],
      ),
      GoRoute(
        path: '/orders/create',
        builder: (context, state) => const OrderCreatePage(),
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (context, state) =>
            OrderDetailPage(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
          path: '/tickets',
          builder: (context, state) => const TicketsPage()),
      GoRoute(
        path: '/tickets/new',
        builder: (context, state) => TicketCreatePage(
          orderId: state.uri.queryParameters['orderId'],
        ),
      ),
      GoRoute(
        path: '/tickets/:id',
        builder: (context, state) =>
            TicketDetailPage(ticketId: state.pathParameters['id']!),
      ),
      GoRoute(
          path: '/invoices',
          builder: (context, state) => const InvoicesPage()),
      GoRoute(path: '/help', builder: (context, state) => const HelpPage()),
      GoRoute(
        path: '/help/:id',
        builder: (context, state) =>
            HelpDetailPage(articleId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/faults',
        builder: (context, state) =>
            const PilotRecordsPage(initialTab: 1),
      ),
      GoRoute(
        path: '/ops/maintenance',
        builder: (context, state) => const OpsMaintenancePage(),
      ),
      GoRoute(
        path: '/ops/faults',
        builder: (context, state) => const OpsFaultsPage(),
      ),
      GoRoute(
        path: '/faults/new',
        builder: (context, state) => FaultReportPage(
          droneId: state.uri.queryParameters['droneId'],
        ),
      ),
      GoRoute(
        path: '/faults/:id',
        builder: (context, state) =>
            FaultDetailPage(faultId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/alerts', builder: (context, state) => const AlertsPage()),
      GoRoute(
          path: '/alerts/new',
          builder: (context, state) => const AlertCreatePage()),
      GoRoute(
        path: '/alerts/:id',
        builder: (context, state) =>
            AlertDetailPage(alertId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/settings/server',
        builder: (context, state) => const ServerSettingsPage(),
      ),
    ],
  );
});

class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    // 注意：必须监听整个 authProvider（不能 select 用户 id）：
    // 未登录时 value 始终为 null，select 不会触发通知，会导致停留在启动页。
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

String _homeFor(AuthUser user) {
  if (user.isPilot) return '/workbench';
  if (user.roles.contains('Admin')) return '/admin/workbench';
  if (user.isOperations) return '/ops/workbench';
  if (user.isCustomer) return '/home';
  return '/workbench';
}

class _RoleWorkbench extends ConsumerWidget {
  const _RoleWorkbench();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user != null && user.isPilot) {
      return const PilotWorkbenchPage();
    }
    return const SimpleWorkbenchPage();
  }
}

class _SplashPage extends StatelessWidget {
  const _SplashPage();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.flight_takeoff_rounded,
                size: 52, color: AppColors.primary),
            SizedBox(height: 16),
            Text('天枢 · 低空智能运营管控平台',
                style: TextStyle(fontSize: 15, color: AppColors.text)),
            SizedBox(height: 20),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
          ],
        ),
      ),
    );
  }
}
