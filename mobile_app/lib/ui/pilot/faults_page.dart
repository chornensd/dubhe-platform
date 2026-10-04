import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/app_map.dart';
import '../widgets/common.dart';

class FaultReportPage extends ConsumerStatefulWidget {
  const FaultReportPage({super.key, this.droneId});

  final String? droneId;

  @override
  ConsumerState<FaultReportPage> createState() => _FaultReportPageState();
}

class _FaultReportPageState extends ConsumerState<FaultReportPage> {
  final _description = TextEditingController();
  String _faultType = Dict.faultTypes.first;
  String? _droneId;
  final List<String> _photoUrls = [];
  Waypoint? _location;
  bool _locating = false;
  bool _submitting = false;
  bool _uploading = false;
  String? _uploadHint;

  @override
  void initState() {
    super.initState();
    _droneId = widget.droneId;
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickPhotos() async {
    final picker = ImagePicker();
    try {
      final images = await picker.pickMultiImage(imageQuality: 72);
      if (images.isEmpty) return;
      setState(() {
        _uploading = true;
        _uploadHint = '正在上传 ${images.length} 张图片…';
      });
      for (final image in images) {
        final bytes = await image.readAsBytes();
        final url = await ref.read(apiServiceProvider).uploadFile(
              filename: image.name,
              bytes: bytes,
            );
        if (url.isNotEmpty) _photoUrls.add(url);
      }
      setState(() {
        _uploading = false;
        _uploadHint = _photoUrls.isEmpty
            ? '上传失败，请检查服务器地址'
            : '已上传 ${_photoUrls.length} 张图片';
      });
    } on ApiException catch (e) {
      setState(() {
        _uploading = false;
        _uploadHint = '上传失败：${e.message}';
      });
    } catch (e) {
      setState(() {
        _uploading = false;
        _uploadHint = '上传失败：$e';
      });
    }
  }

  Future<void> _useCurrentFlightLocation() async {
    setState(() => _locating = true);
    try {
      final page = await ref
          .read(apiServiceProvider)
          .searchOrders(pageNum: 1, pageSize: 50, status: 'InFlight');
      if (!mounted) return;
      if (page.items.isNotEmpty) {
        final detail =
            await ref.read(apiServiceProvider).orderDetail(page.items.first.id);
        if (!mounted) return;
        setState(() {
          _location = Waypoint(detail.sender.lat, detail.sender.lng);
          _locating = false;
        });
        showAppSnack(context, '已使用当前任务起点坐标（可在地图上调整）');
      } else {
        final drones = ref.read(myDronesProvider).value ?? const [];
        setState(() {
          _locating = false;
          if (drones.isNotEmpty) {
            _location = const Waypoint(30.2741, 120.1551);
          }
        });
        if (mounted) showAppSnack(context, '当前无执行中任务，请在地图上手动选点', error: false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _locating = false);
        showAppSnack(context, '定位失败：$e', error: true);
      }
    }
  }

  Future<void> _pickLocation() async {
    var picked = _location ?? const Waypoint(30.2741, 120.1551);
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 14,
            bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('选择故障位置',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              AppMap(
                height: 280,
                defaultCenter: picked,
                pickable: true,
                markers: [MapMarker(lat: picked.lat, lng: picked.lng, pulse: true)],
                onPick: (value) => setSheetState(() => picked = value),
              ),
              const SizedBox(height: 10),
              Text(
                '坐标：${picked.lat.toStringAsFixed(5)}, ${picked.lng.toStringAsFixed(5)}',
                style: const TextStyle(fontSize: 12.5),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('确认位置'),
              ),
            ],
          ),
        ),
      ),
    );
    if (confirmed == true) setState(() => _location = picked);
  }

  Future<void> _submit() async {
    if (_droneId == null || _droneId!.isEmpty) {
      showAppSnack(context, '请选择故障飞行器', error: true);
      return;
    }
    if (_description.text.trim().length < 5) {
      showAppSnack(context, '请描述故障现象（至少 5 个字）', error: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      final fault = await ref.read(apiServiceProvider).reportFault(
            droneId: _droneId!,
            faultType: _faultType,
            description: _description.text.trim(),
            photoUrls: _photoUrls.isEmpty ? null : _photoUrls,
            lat: _location?.lat,
            lng: _location?.lng,
          );
      if (!mounted) return;
      showAppSnack(context, '故障已上报，等待运维处理');
      context.pushReplacement('/faults/${fault.id}');
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dronesAsync = ref.watch(myDronesProvider);
    final drones = dronesAsync.value ?? const [];

    return AppScaffold(
      title: '故障上报',
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          SectionCard(
            title: '故障飞行器',
            child: dronesAsync.isLoading
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: LoadingView(),
                  )
                : drones.isEmpty
                    ? const EmptyView(
                        text: '暂无可选飞行器（需先有派给你的飞行任务）',
                        icon: Icons.airplanemode_inactive,
                      )
                    : DropdownButtonFormField<String>(
                        initialValue:
                            drones.any((d) => d.id == _droneId) ? _droneId : null,
                        items: [
                          for (final drone in drones)
                            DropdownMenuItem(
                              value: drone.id,
                              child: Text(
                                '${drone.serialNo} · ${drone.model}（电量 ${drone.batteryPercent}%）',
                                style: const TextStyle(fontSize: 13.5),
                              ),
                            ),
                        ],
                        onChanged: (value) => setState(() => _droneId = value),
                        decoration: const InputDecoration(hintText: '请选择飞行器'),
                      ),
          ),
          SectionCard(
            title: '故障信息',
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _faultType,
                  items: [
                    for (final type in Dict.faultTypes)
                      DropdownMenuItem(
                        value: type,
                        child: Text(type, style: const TextStyle(fontSize: 14)),
                      ),
                  ],
                  onChanged: (value) =>
                      setState(() => _faultType = value ?? Dict.faultTypes.first),
                  decoration: const InputDecoration(hintText: '故障类型'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _description,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    hintText: '请描述故障现象、发生时间与影响（如：起飞后右前桨异响）',
                  ),
                ),
              ],
            ),
          ),
          SectionCard(
            title: '现场照片',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: _uploading ? null : _pickPhotos,
                      icon: _uploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.photo_library_outlined, size: 18),
                      label: Text(_photoUrls.isEmpty
                          ? '从相册选择'
                          : '继续添加（${_photoUrls.length}）'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _uploadHint ?? '支持多图，上传后可关联至故障记录',
                        style: const TextStyle(
                            fontSize: 11.5, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
                if (_photoUrls.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final url in _photoUrls)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.image_outlined,
                                    size: 14, color: AppColors.primary),
                                const SizedBox(width: 4),
                                Text(
                                  url.split('/').last,
                                  style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.primary),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          SectionCard(
            title: '故障定位',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_location != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      '坐标：${_location!.lat.toStringAsFixed(5)}, ${_location!.lng.toStringAsFixed(5)}',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _locating ? null : _useCurrentFlightLocation,
                        icon: const Icon(Icons.my_location_rounded, size: 17),
                        label: Text(_locating ? '定位中…' : '取任务坐标'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickLocation,
                        icon: const Icon(Icons.map_outlined, size: 17),
                        label: const Text('地图选点'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('提交故障上报'),
          ),
        ],
      ),
    );
  }
}

class FaultDetailPage extends ConsumerStatefulWidget {
  const FaultDetailPage({super.key, required this.faultId});

  final String faultId;

  @override
  ConsumerState<FaultDetailPage> createState() => _FaultDetailPageState();
}

class _FaultDetailPageState extends ConsumerState<FaultDetailPage> {
  FaultItem? _fault;
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
      final fault =
          await ref.read(apiServiceProvider).fault(widget.faultId);
      if (!mounted) return;
      setState(() {
        _fault = fault;
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

  @override
  Widget build(BuildContext context) {
    final fault = _fault;
    final user = ref.watch(currentUserProvider);
    return AppScaffold(
      title: '故障详情',
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
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
                                    fault!.faultType,
                                    style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                                StatusChip(Dict.of(
                                    Dict.faultStatusNames, fault.status)),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              fault.description,
                              style: const TextStyle(
                                  fontSize: 14, height: 1.7),
                            ),
                          ],
                        ),
                      ),
                      SectionCard(
                        title: '故障信息',
                        child: Column(
                          children: [
                            InfoRow('上报时间', Fmt.dateTime(fault.reportedAt)),
                            InfoRow('飞行器', fault.droneId),
                            if (fault.lat != null && fault.lng != null)
                              InfoRow(
                                '故障位置',
                                '${fault.lat!.toStringAsFixed(5)}, ${fault.lng!.toStringAsFixed(5)}',
                              ),
                            if (fault.resolvedAt != null)
                              InfoRow('解决时间', Fmt.dateTime(fault.resolvedAt)),
                            if (user != null && user.id == fault.reportedBy)
                              const InfoRow('上报人', '我'),
                          ],
                        ),
                      ),
                      if (fault.photoUrls.isNotEmpty)
                        SectionCard(
                          title: '现场照片',
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final _ in fault.photoUrls)
                                Container(
                                  width: 86,
                                  height: 86,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF3F5F7),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.image_outlined,
                                      color: AppColors.textSecondary),
                                ),
                            ],
                          ),
                        ),
                      SectionCard(
                        title: '处理进度',
                        child: TimelineView(
                          entries: [
                            TimelineEntry(
                              title: '故障已上报',
                              time: Fmt.monthDay(fault.reportedAt),
                              color: AppColors.warning,
                            ),
                            TimelineEntry(
                              title: fault.status == 'Reported'
                                  ? '等待运维受理'
                                  : '运维处理中',
                              time: fault.status == 'Reported'
                                  ? null
                                  : Fmt.monthDay(fault.reportedAt),
                              color: fault.status == 'Reported'
                                  ? AppColors.neutral
                                  : AppColors.processing,
                            ),
                            TimelineEntry(
                              title: '故障已解决',
                              subtitle: fault.resolution,
                              time: fault.resolvedAt == null
                                  ? null
                                  : Fmt.monthDay(fault.resolvedAt),
                              color: fault.status == 'Resolved'
                                  ? AppColors.success
                                  : AppColors.neutral,
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
