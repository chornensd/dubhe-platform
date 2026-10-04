import { Injectable, inject } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Observable, from, map } from 'rxjs';
import { PromptContentComponent, PromptData } from '../shared/prompt-content';

export interface ConfirmOptions {
  title: string;
  content: string;
  okText?: string;
  danger?: boolean;
}

/** 二次确认与原因填写弹窗（危险/驳回类操作统一走这里） */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modal = inject(NzModalService);

  open(options: ConfirmOptions): Observable<boolean> {
    const ref = this.modal.confirm({
      nzTitle: options.title,
      nzContent: options.content,
      nzOkText: options.okText ?? '确认',
      nzOkDanger: options.danger ?? false,
      nzCancelText: '取消',
      nzCentered: true,
    });
    return from(ref.afterClose).pipe(map((result: unknown) => result === true));
  }

  /** 填写原因/内容后提交，取消返回 null */
  prompt(options: {
    title: string;
    placeholder?: string;
    required?: boolean;
    okText?: string;
    danger?: boolean;
    multiline?: boolean;
    defaultValue?: string;
  }): Observable<string | null> {
    const data: PromptData = {
      value: options.defaultValue ?? '',
      error: '',
      placeholder: options.placeholder,
      multiline: options.multiline,
    };
    const ref = this.modal.create({
      nzTitle: options.title,
      nzContent: PromptContentComponent,
      nzData: data,
      nzOkText: options.okText ?? '提交',
      nzCancelText: '取消',
      nzOkDanger: options.danger ?? false,
      nzCentered: true,
      nzWidth: 480,
      nzOnOk: () => {
        if (options.required !== false && !data.value.trim()) {
          data.error = '请填写内容';
          return false;
        }
        return true;
      },
    });
    return ref.afterClose.pipe(map((ok: unknown) => (ok === true ? data.value.trim() : null)));
  }
}
