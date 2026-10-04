import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dubhe_mobile/ui/theme.dart';

void main() {
  testWidgets('应用主题与基础组件渲染冒烟', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: buildAppTheme(),
          home: const Scaffold(
            body: Center(child: Text('天枢移动端')),
          ),
        ),
      ),
    );
    expect(find.text('天枢移动端'), findsOneWidget);
  });
}
