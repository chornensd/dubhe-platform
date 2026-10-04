import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';

export interface PromptData {
  value: string;
  error: string;
  placeholder?: string;
  multiline?: boolean;
}

/** 弹窗输入内容（供 ConfirmService.prompt 使用） */
@Component({
  selector: 'app-prompt-content',
  standalone: true,
  imports: [FormsModule, NzInputModule],
  template: `
    @if (data.multiline === false) {
      <input nz-input [placeholder]="data.placeholder ?? '请填写...'" [(ngModel)]="data.value" />
    } @else {
      <textarea nz-input rows="3" [placeholder]="data.placeholder ?? '请填写...'" [(ngModel)]="data.value"></textarea>
    }
    @if (data.error) {
      <div class="prompt-error">{{ data.error }}</div>
    }
  `,
  styles: ['.prompt-error { color: #ff4d4f; font-size: 12px; margin-top: 4px; }'],
})
export class PromptContentComponent {
  readonly data = inject(NZ_MODAL_DATA) as PromptData;
}
