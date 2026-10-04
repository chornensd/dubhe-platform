import { Component, EventEmitter, Output, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';

export interface SelectOption {
  label: string;
  value: string | number | null;
  disabled?: boolean;
}

/** 远程搜索下拉（服务端搜索，供选择商家/用户/飞行器等实体） */
@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [FormsModule, NzSelectModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true }],
  template: `
    <nz-select
      style="width: 100%"
      nzShowSearch
      nzServerSearch
      nzAllowClear
      [nzPlaceHolder]="placeholder()"
      [nzOptions]="options()"
      [nzLoading]="loading()"
      [nzDisabled]="disabled"
      [ngModel]="value"
      (ngModelChange)="onChange($event)"
      (nzOnSearch)="search.emit($event)"
      (nzBlur)="onTouched()"
    ></nz-select>
  `,
})
export class SearchSelectComponent implements ControlValueAccessor {
  readonly options = input<SelectOption[]>([]);
  readonly loading = input(false);
  readonly placeholder = input('输入关键字搜索');

  @Output() readonly search = new EventEmitter<string>();

  value: string | number | null = null;
  disabled = false;

  private propagate: (value: string | number | null) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: string | number | null): void {
    this.value = value ?? null;
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.propagate = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onChange(value: string | number | null): void {
    this.value = value;
    this.propagate(value);
  }
}
