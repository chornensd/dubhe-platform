import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';

export interface Waypoint {
  lat: number;
  lng: number;
}

/** 航点编辑器（latitude/longitude 列表） */
@Component({
  selector: 'app-waypoint-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NzInputNumberModule, NzButtonModule, NzIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => WaypointEditorComponent), multi: true }],
  template: `
    <div class="wp">
      @for (point of points; track $index) {
        <div class="wp__row">
          <span class="wp__index">{{ $index + 1 }}</span>
          <nz-input-number
            class="wp__num"
            [nzMin]="-90"
            [nzMax]="90"
            [nzStep]="0.0001"
            [nzPlaceHolder]="'纬度'"
            [ngModel]="point.lat"
            (ngModelChange)="update($index, 'lat', $event)"
          />
          <nz-input-number
            class="wp__num"
            [nzMin]="-180"
            [nzMax]="180"
            [nzStep]="0.0001"
            [nzPlaceHolder]="'经度'"
            [ngModel]="point.lng"
            (ngModelChange)="update($index, 'lng', $event)"
          />
          <button nz-button nzType="text" nzDanger nzSize="small" (click)="remove($index)" title="删除">
            <span nz-icon nzType="delete"></span>
          </button>
        </div>
      }
      <div class="wp__actions">
        <button nz-button nzSize="small" (click)="add()">
          <span nz-icon nzType="plus"></span> 添加航点
        </button>
        <span class="wp__hint">经纬度按十进制填写，例如 30.2741 / 120.1551</span>
      </div>
    </div>
  `,
  styles: [
    `
      .wp__row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .wp__index {
        width: 20px;
        color: #98a2b3;
        font-size: 12px;
      }
      .wp__num {
        flex: 1;
      }
      .wp__actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wp__hint {
        font-size: 12px;
        color: #98a2b3;
      }
    `,
  ],
})
export class WaypointEditorComponent implements ControlValueAccessor {
  points: Waypoint[] = [];

  private onChange: (value: Waypoint[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: Waypoint[] | null): void {
    this.points = Array.isArray(value) ? value.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })) : [];
  }

  registerOnChange(fn: (value: Waypoint[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  add(): void {
    this.points = [...this.points, { lat: 30.2741, lng: 120.1551 }];
    this.emit();
  }

  remove(index: number): void {
    this.points = this.points.filter((_, i) => i !== index);
    this.emit();
  }

  update(index: number, key: 'lat' | 'lng', value: number): void {
    this.points = this.points.map((point, i) => (i === index ? { ...point, [key]: value ?? 0 } : point));
    this.emit();
  }

  private emit(): void {
    this.onChange(this.points);
    this.onTouched();
  }
}
