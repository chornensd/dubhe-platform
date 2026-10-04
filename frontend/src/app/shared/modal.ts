import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ContentChild, EventEmitter, Output, inject, input, model } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { SchemaFormComponent } from './schema-form';

/** 统一弹窗：内置 SchemaForm 校验（弹窗内直接放 app-schema-form 即可） */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, NzModalModule, NzButtonModule],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="title()"
      [nzOkText]="okText()"
      [nzCancelText]="cancelText()"
      [nzOkLoading]="loading()"
      [nzOkDanger]="okDanger()"
      [nzWidth]="width()"
      [nzCentered]="true"
      [nzMaskClosable]="false"
      [nzOkDisabled]="okDisabled()"
      (nzOnCancel)="close()"
      (nzOnOk)="handleOk()"
    >
      <ng-container *nzModalContent>
        <ng-content />
      </ng-container>
    </nz-modal>
  `,
})
export class ModalComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly open = model(false);
  readonly title = input('编辑');
  readonly okText = input('保存');
  readonly cancelText = input('取消');
  readonly loading = input(false);
  readonly okDanger = input(false);
  readonly width = input<number | string>(620);
  readonly okDisabled = input(false);

  @Output() readonly ok = new EventEmitter<void>();
  @Output() readonly closed = new EventEmitter<void>();

  @ContentChild(SchemaFormComponent) form?: SchemaFormComponent;

  close(): void {
    this.open.set(false);
    this.closed.emit();
  }

  handleOk(): void {
    if (this.form) {
      const valid = this.form.validate();
      this.cdr.markForCheck();
      if (!valid) return;
    }
    this.ok.emit();
  }
}
