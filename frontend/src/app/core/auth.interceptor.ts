import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, catchError, finalize, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import type { ApiError } from './api.service';

let refreshing = false;

function withHeaders(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  const headers: Record<string, string> = { 'Device-Type': 'PC' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return req.clone({ setHeaders: headers });
}

/** 注入 Bearer/Device-Type，401 时自动刷新令牌并重放请求，统一错误提示 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);
  const message = inject(NzMessageService);

  if (!req.url.startsWith('/api')) return next(req);

  const isAuthEndpoint = /\/(auth\/login|auth\/register|auth\/refresh)$/.test(req.url);
  const authed = withHeaders(req, auth.accessToken);

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      const body = error.error as { code?: string; message?: string } | null;
      const code = body?.code ?? '';

      if (error.status === 401 && !isAuthEndpoint && auth.refreshToken && !refreshing) {
        refreshing = true;
        return auth.refresh().pipe(
          switchMap(() => next(withHeaders(req, auth.accessToken))),
          catchError((refreshError: unknown) => {
            auth.logout(false);
            message.error('登录已过期，请重新登录');
            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshing = false;
          }),
        );
      }

      if (error.status === 401 && !isAuthEndpoint) auth.logout(false);

      if (error.status !== 401 || isAuthEndpoint) {
        message.error(body?.message || `请求失败（HTTP ${error.status}）`);
      }

      const apiError: ApiError = {
        code: code || 'http_error',
        message: body?.message ?? `请求失败（HTTP ${error.status}）`,
        status: error.status,
      };
      return throwError(() => apiError);
    }),
  );
};
