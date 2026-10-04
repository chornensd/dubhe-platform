import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** 权限点判断：Admin 通配；支持任一命中（或关系） */
export function hasAnyPermission(permissions: string[] | null | undefined, required: string[]): boolean {
  if (!required.length) return true;
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  return required.some((code) => permissions.includes(code));
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return true;
  return router.createUrlTree(['/dashboard']);
};

/** 路由级权限：permGuard(['order.read']) */
export function permGuard(required: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (hasAnyPermission(auth.permissions(), required)) return true;
    return router.createUrlTree(['/forbidden']);
  };
}

/** 便捷函数：页面内使用（信号读取，自动随权限变化） */
export function can(permissions: string[] | null | undefined, code: string): boolean {
  return hasAnyPermission(permissions, [code]);
}

export function hasRole(roles: string[] | null | undefined, code: string): boolean {
  return !!roles?.includes(code);
}
