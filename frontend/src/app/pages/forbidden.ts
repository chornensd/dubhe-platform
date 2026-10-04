import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzResultModule } from 'ng-zorro-antd/result';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [NzResultModule, NzButtonModule],
  template: `
    <nz-result nzStatus="403" nzTitle="403" nzSubTitle="当前账号没有访问该页面的权限，如需开通请联系平台管理员">
      <div nz-result-extra>
        <button nz-button nzType="primary" (click)="back()">返回工作台</button>
      </div>
    </nz-result>
  `,
})
export class ForbiddenPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  back(): void {
    const roles = this.auth.roles();
    void this.router.navigateByUrl(roles.includes('Admin') ? '/dashboard' : '/dashboard');
  }
}
