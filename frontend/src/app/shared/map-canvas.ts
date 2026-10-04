import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  afterNextRender,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapZone extends LatLng {
  radiusKm: number;
  /** NoFly 禁飞 / Restricted 限飞 / TemporaryControl 临时管制 / Fence 电子围栏 */
  type: string;
  name?: string;
  code?: string;
  active?: boolean;
}

export interface MapMarker extends LatLng {
  label?: string;
  tone?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
  pulse?: boolean;
}

export interface MapHeat extends LatLng {
  count: number;
}

interface Projected {
  x: number;
  y: number;
}

const KM_PER_DEG = 111.32;
const DEFAULT_CENTER: LatLng = { lat: 30.2741, lng: 120.1551 };

/** 轻量空域地图：经纬度投影绘制禁飞/限飞/管制区、围栏、航点航线、热力与位置标记（无需第三方地图 Key） */
@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map" [style.height.px]="height()" #wrap>
      <svg
        class="map__svg"
        [attr.viewBox]="viewBox()"
        preserveAspectRatio="xMidYMid meet"
        (pointerdown)="onDown($event)"
        (pointermove)="onMove($event)"
        (pointerup)="onUp($event)"
        (pointerleave)="onUp($event)"
        (wheel)="onWheel($event)"
      >
        @for (line of gridLines(); track line.id) {
          <line [attr.x1]="line.x1" [attr.y1]="line.y1" [attr.x2]="line.x2" [attr.y2]="line.y2" class="map__grid" />
        }
        @for (label of gridLabels(); track label.id) {
          <text [attr.x]="label.x" [attr.y]="label.y" [attr.font-size]="unit() * 0.42" class="map__grid-label">
            {{ label.text }}
          </text>
        }

        @for (cell of heatCells(); track $index) {
          <circle
            [attr.cx]="cell.x"
            [attr.cy]="cell.y"
            [attr.r]="cell.r"
            [attr.fill]="'rgba(255,77,79,' + cell.opacity + ')'"
            class="map__heat"
          />
        }

        @for (zone of zoneShapes(); track zone.id) {
          <g [class.map__zone--inactive]="!zone.active">
            <circle
              [attr.cx]="zone.x"
              [attr.cy]="zone.y"
              [attr.r]="zone.r"
              [attr.fill]="zone.fill"
              [attr.stroke]="zone.stroke"
              [attr.stroke-dasharray]="zone.active ? null : '4 3'"
              class="map__zone"
            />
            @if (zone.name) {
              <text [attr.x]="zone.x" [attr.y]="zone.y + unit() * 0.16" [attr.font-size]="unit() * 0.46" class="map__zone-label">
                {{ zone.name }}
              </text>
            }
          </g>
        }

        @if (pathPoints(); as points) {
          @if (points.length > 1) {
            <polyline [attr.points]="points" class="map__path" />
          }
          @for (point of pathNodes(); track $index) {
            <circle [attr.cx]="point.x" [attr.cy]="point.y" [attr.r]="unit() * 0.16" class="map__path-node" />
          }
        }

        @for (marker of markerShapes(); track $index) {
          <g>
            @if (marker.pulse) {
              <circle [attr.cx]="marker.x" [attr.cy]="marker.y" [attr.r]="unit() * 0.7" class="map__marker-pulse" />
            }
            <circle [attr.cx]="marker.x" [attr.cy]="marker.y" [attr.r]="unit() * 0.24" [attr.fill]="marker.color" class="map__marker" />
            @if (marker.label) {
              <text [attr.x]="marker.x" [attr.y]="marker.y - unit() * 0.38" [attr.font-size]="unit() * 0.46" class="map__marker-label">
                {{ marker.label }}
              </text>
            }
          </g>
        }
      </svg>

      @if (!zoneShapes().length && !markerShapes().length && !heatCells().length && !pathNodes().length) {
        <div class="map__empty">暂无经纬度数据，可录入坐标后查看空间分布</div>
      }

      <div class="map__legend">
        <span><i class="dot dot--nofly"></i>禁飞区</span>
        <span><i class="dot dot--restricted"></i>限飞区</span>
        <span><i class="dot dot--temp"></i>临时管制</span>
        <span><i class="dot dot--fence"></i>电子围栏</span>
      </div>

      @if (zoomable()) {
        <div class="map__tools">
          <button type="button" (click)="zoomBy(1.4)">＋</button>
          <button type="button" (click)="zoomBy(1 / 1.4)">－</button>
          <button type="button" (click)="resetView()" title="复位">↺</button>
        </div>
      }

      @if (pickable()) {
        <div class="map__hint">点击地图拾取经纬度</div>
      }
    </div>
  `,
  styles: [
    `
      .map {
        position: relative;
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        background: radial-gradient(circle at 30% 20%, #f5f9ff 0%, #eaf1fb 45%, #e2ecfa 100%);
        border: 1px solid #e3eaf5;
      }
      .map__svg {
        width: 100%;
        height: 100%;
        display: block;
        cursor: crosshair;
        touch-action: none;
      }
      .map__grid {
        stroke: #d7e3f5;
        stroke-width: 0.5;
        vector-effect: non-scaling-stroke;
      }
      .map__grid-label {
        fill: #a9b8cf;
        font-family: inherit;
      }
      .map__zone {
        fill-opacity: 0.22;
        stroke-width: 1.4;
        vector-effect: non-scaling-stroke;
      }
      .map__zone--inactive {
        opacity: 0.35;
      }
      .map__zone-label {
        fill: #334155;
        text-anchor: middle;
        font-family: inherit;
      }
      .map__heat {
        mix-blend-mode: multiply;
      }
      .map__path {
        fill: none;
        stroke: #1677ff;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-dasharray: 8 4;
        vector-effect: non-scaling-stroke;
      }
      .map__path-node {
        fill: #fff;
        stroke: #1677ff;
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .map__marker {
        stroke: #fff;
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .map__marker-pulse {
        fill: rgba(255, 77, 79, 0.25);
        animation: pulse 1.8s ease-out infinite;
      }
      @keyframes pulse {
        0% {
          opacity: 0.9;
          transform: scale(0.6);
          transform-origin: center;
        }
        100% {
          opacity: 0;
          transform: scale(1.6);
          transform-origin: center;
        }
      }
      .map__marker-label {
        fill: #1f2637;
        text-anchor: middle;
        font-family: inherit;
      }
      .map__legend {
        position: absolute;
        left: 12px;
        bottom: 12px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid #e3eaf5;
        border-radius: 6px;
        padding: 6px 10px;
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #4a5568;
      }
      .map__legend .dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 4px;
      }
      .dot--nofly {
        background: #ff4d4f;
      }
      .dot--restricted {
        background: #faad14;
      }
      .dot--temp {
        background: #722ed1;
      }
      .dot--fence {
        background: #1677ff;
      }
      .map__tools {
        position: absolute;
        right: 12px;
        top: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .map__tools button {
        width: 28px;
        height: 28px;
        border: 1px solid #d9e2f0;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 6px;
        cursor: pointer;
        color: #334155;
      }
      .map__tools button:hover {
        border-color: #1677ff;
        color: #1677ff;
      }
      .map__hint {
        position: absolute;
        right: 12px;
        bottom: 12px;
        background: rgba(22, 119, 255, 0.1);
        color: #1677ff;
        border: 1px solid #91caff;
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 12px;
      }
      .map__empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #a9b8cf;
        font-size: 13px;
        pointer-events: none;
      }
    `,
  ],
})
export class MapCanvasComponent implements OnDestroy {
  readonly zones = input<MapZone[]>([]);
  readonly markers = input<MapMarker[]>([]);
  readonly path = input<LatLng[] | null>(null);
  readonly heat = input<MapHeat[]>([]);
  readonly height = input(480);
  readonly pickable = input(false);
  readonly zoomable = input(true);

  @Output() readonly pick = new EventEmitter<LatLng>();

  private readonly wrap = viewChild.required<ElementRef<HTMLDivElement>>('wrap');
  private readonly size = signal({ width: 800, height: 480 });
  private readonly zoom = signal(1);
  private readonly pan = signal<Projected>({ x: 0, y: 0 });

  private dragStart: { x: number; y: number; pan: Projected } | null = null;
  private moved = false;

  private readonly center = computed<LatLng>(() => {
    const all: LatLng[] = [
      ...this.zones(),
      ...this.markers(),
      ...this.heat(),
      ...(this.path() ?? []),
    ];
    if (!all.length) return DEFAULT_CENTER;
    const lat = all.reduce((sum, p) => sum + p.lat, 0) / all.length;
    const lng = all.reduce((sum, p) => sum + p.lng, 0) / all.length;
    return { lat, lng };
  });

  private readonly cosLat = computed(() => Math.cos((this.center().lat * Math.PI) / 180) || 1);

  private readonly bounds = computed(() => {
    const items: (LatLng & { radiusKm?: number })[] = [...this.zones(), ...this.markers(), ...this.heat(), ...(this.path() ?? [])];
    const cos = this.cosLat();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    if (!items.length) {
      const c = DEFAULT_CENTER;
      return { minX: c.lng * cos - 0.05, maxX: c.lng * cos + 0.05, minY: -c.lat - 0.04, maxY: -c.lat + 0.04 };
    }
    for (const item of items) {
      const x = item.lng * cos;
      const y = -item.lat;
      const rx = (item.radiusKm ?? 0.6) / KM_PER_DEG;
      minX = Math.min(minX, x - rx);
      maxX = Math.max(maxX, x + rx);
      minY = Math.min(minY, y - rx);
      maxY = Math.max(maxY, y + rx);
    }
    const padX = Math.max((maxX - minX) * 0.12, 0.004);
    const padY = Math.max((maxY - minY) * 0.12, 0.004);
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  });

  /** 缩放/平移后的世界坐标视口 */
  private readonly worldView = computed(() => {
    const bounds = this.bounds();
    const size = this.size();
    const cos = this.cosLat();
    const dataW = Math.max(bounds.maxX - bounds.minX, 1e-5);
    const dataH = Math.max(bounds.maxY - bounds.minY, 1e-5);
    const aspect = size.width / Math.max(size.height, 1);
    let w = dataW;
    let h = dataH;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    const cx = (bounds.minX + bounds.maxX) / 2 + this.pan().x;
    const cy = (bounds.minY + bounds.maxY) / 2 + this.pan().y;
    const zoom = this.zoom();
    return { x: cx - w / 2 / zoom, y: cy - h / 2 / zoom, w: w / zoom, h: h / zoom, cos };
  });

  readonly unit = computed(() => this.worldView().w / 60);

  readonly viewBox = computed(() => {
    const view = this.worldView();
    return `${view.x} ${view.y} ${view.w} ${view.h}`;
  });

  private project(point: LatLng): Projected {
    const view = this.worldView();
    return { x: point.lng * view.cos, y: -point.lat };
  }

  readonly zoneShapes = computed(() => {
    const palette: Record<string, { fill: string; stroke: string }> = {
      NoFly: { fill: '#ff4d4f', stroke: '#cf1322' },
      Restricted: { fill: '#faad14', stroke: '#d48806' },
      TemporaryControl: { fill: '#722ed1', stroke: '#531dab' },
      Fence: { fill: '#1677ff', stroke: '#0958d9' },
      MerchantFence: { fill: '#1677ff', stroke: '#0958d9' },
    };
    return this.zones().map((zone, index) => {
      const p = this.project(zone);
      const color = palette[zone.type] ?? palette['Fence'];
      return {
        id: `${zone.code ?? zone.name ?? index}-${index}`,
        x: p.x,
        y: p.y,
        r: zone.radiusKm / KM_PER_DEG,
        fill: color.fill,
        stroke: color.stroke,
        name: zone.name,
        active: zone.active !== false,
      };
    });
  });

  readonly markerShapes = computed(() => {
    const palette: Record<string, string> = {
      blue: '#1677ff',
      green: '#52c41a',
      red: '#ff4d4f',
      orange: '#faad14',
      purple: '#722ed1',
      gray: '#8c8c8c',
    };
    return this.markers().map((marker) => {
      const p = this.project(marker);
      return { ...p, label: marker.label, color: palette[marker.tone ?? 'blue'], pulse: marker.pulse ?? false };
    });
  });

  readonly heatCells = computed(() => {
    const heat = this.heat();
    if (!heat.length) return [];
    const max = Math.max(...heat.map((h) => h.count), 1);
    return heat.map((cell) => {
      const p = this.project(cell);
      const ratio = cell.count / max;
      return { ...p, r: this.unit() * (0.3 + ratio * 0.9), opacity: (0.15 + ratio * 0.5).toFixed(2) };
    });
  });

  readonly pathNodes = computed(() => (this.path() ?? []).map((point) => this.project(point)));
  readonly pathPoints = computed(() =>
    this.path()?.length ? this.pathNodes().map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`).join(' ') : null,
  );

  readonly gridLines = computed(() => {
    const view = this.worldView();
    const step = niceStep(view.w / 6);
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    const startX = Math.ceil(view.x / step) * step;
    for (let x = startX; x <= view.x + view.w; x += step) {
      lines.push({ id: `v${x.toFixed(4)}`, x1: x, y1: view.y, x2: x, y2: view.y + view.h });
    }
    const startY = Math.ceil(view.y / step) * step;
    for (let y = startY; y <= view.y + view.h; y += step) {
      lines.push({ id: `h${y.toFixed(4)}`, x1: view.x, y1: y, x2: view.x + view.w, y2: y });
    }
    return lines;
  });

  readonly gridLabels = computed(() => {
    const view = this.worldView();
    const step = niceStep(view.w / 6);
    const labels: { id: string; x: number; y: number; text: string }[] = [];
    const startX = Math.ceil(view.x / step) * step;
    for (let x = startX; x <= view.x + view.w; x += step) {
      const lng = x / view.cos;
      labels.push({ id: `lx${x.toFixed(4)}`, x: x + this.unit() * 0.06, y: view.y + this.unit() * 0.45, text: `${lng.toFixed(3)}°E` });
    }
    const startY = Math.ceil(view.y / step) * step;
    for (let y = startY; y <= view.y + view.h; y += step) {
      labels.push({ id: `ly${y.toFixed(4)}`, x: view.x + this.unit() * 0.06, y: y - this.unit() * 0.12, text: `${(-y).toFixed(3)}°N` });
    }
    return labels;
  });

  private observer?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      const host = this.wrap().nativeElement;
      const rect = host.getBoundingClientRect();
      if (rect.width && rect.height) this.size.set({ width: rect.width, height: rect.height });
      this.observer = new ResizeObserver(() => {
        const box = host.getBoundingClientRect();
        if (box.width && box.height) this.size.set({ width: box.width, height: box.height });
      });
      this.observer.observe(host);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  zoomBy(factor: number): void {
    this.zoom.set(Math.min(Math.max(this.zoom() * factor, 0.6), 40));
  }

  resetView(): void {
    this.zoom.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  onWheel(event: WheelEvent): void {
    if (!this.zoomable()) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoom.set(Math.min(Math.max(this.zoom() * factor, 0.6), 40));
  }

  onDown(event: PointerEvent): void {
    this.dragStart = { x: event.clientX, y: event.clientY, pan: this.pan() };
    this.moved = false;
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onMove(event: PointerEvent): void {
    if (!this.dragStart) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
    const rect = this.wrap().nativeElement.getBoundingClientRect();
    const view = this.worldView();
    const scaleX = view.w / Math.max(rect.width, 1);
    const scaleY = view.h / Math.max(rect.height, 1);
    this.pan.set({ x: this.dragStart.pan.x - dx * scaleX, y: this.dragStart.pan.y - dy * scaleY });
  }

  onUp(event: PointerEvent): void {
    const wasDragging = !!this.dragStart && this.moved;
    this.dragStart = null;
    if (wasDragging || !this.pickable()) return;
    const rect = this.wrap().nativeElement.getBoundingClientRect();
    const view = this.worldView();
    const ratioX = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const ratioY = (event.clientY - rect.top) / Math.max(rect.height, 1);
    if (ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1) return;
    const worldX = view.x + ratioX * view.w;
    const worldY = view.y + ratioY * view.h;
    this.pick.emit({ lat: -worldY, lng: worldX / view.cos });
  }
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const norm = raw / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}
