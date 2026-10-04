import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { hasAnyPermission, hasRole } from './guards';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  can(code: string): boolean {
    return hasAnyPermission(this.auth.permissions(), [code]);
  }

  canAny(codes: string[]): boolean {
    return hasAnyPermission(this.auth.permissions(), codes);
  }

  role(code: string): boolean {
    return hasRole(this.auth.roles(), code);
  }
}
