import { Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';

/** 语义化状态色：按中文关键词判定 */
export function statusTone(text: string): string {
  const t = text ?? '';
  if (/预警|警告|罚款|暂停|限飞|临时|一般/.test(t)) return 'warning';
  if (/待|未|草稿|审核中|即将到期|待审批|待调度|待接单|待处理|待支付|待执行/.test(t)) return 'gold';
  if (/处理中|执行中|飞行|占用|使用中|进行/.test(t)) return 'processing';
  if (/成功|已送达|已完成|已批准|已结算|已确认|已开具|正常|空闲|在职|已支付|已解决|通过|已发布|在线/.test(t)) return 'success';
  if (/失败|取消|驳回|冻结|超期|离线|违规|紧急|严重|缺勤|停职|离职|封禁|禁用|拒绝/.test(t)) return 'error';
  return 'default';
}

@Component({
  selector: 'app-status-tag',
  standalone: true,
  imports: [NzTagModule],
  template: `<nz-tag [nzColor]="tone()">{{ text() }}</nz-tag>`,
})
export class StatusTagComponent {
  readonly value = input<string | number | null | undefined>('');
  readonly map = input<Record<string, string>>({});
  readonly color = input<string | null>(null);

  readonly text = computed(() => {
    const v = this.value();
    if (v === null || v === undefined || v === '') return '-';
    const dict = this.map();
    return dict[String(v)] ?? String(v);
  });

  readonly tone = computed(() => {
    const override = this.color();
    return override ?? statusTone(this.text());
  });
}
