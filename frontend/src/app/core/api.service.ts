import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiResponse, Paged } from './api-types';

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

function toParams(input?: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  if (!input) return params;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/** 统一后端调用：解包 { success, code, message, data }，过滤空查询参数，支持文件下载 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, unknown>): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`/api${path}`, { params: toParams(params) })
      .pipe(map((r) => this.unwrap(r)), catchError(this.handle));
  }

  post<T>(path: string, body?: unknown, params?: Record<string, unknown>): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`/api${path}`, body ?? {}, { params: toParams(params) })
      .pipe(map((r) => this.unwrap(r)), catchError(this.handle));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(`/api${path}`, body ?? {})
      .pipe(map((r) => this.unwrap(r)), catchError(this.handle));
  }

  del<T>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(`/api${path}`).pipe(map((r) => this.unwrap(r)), catchError(this.handle));
  }

  /** multipart 上传（字段名默认 file） */
  upload<T>(path: string, file: File, field = 'file', params?: Record<string, unknown>): Observable<T> {
    const form = new FormData();
    form.append(field, file, file.name);
    return this.http
      .post<ApiResponse<T>>(`/api${path}`, form, { params: toParams(params) })
      .pipe(map((r) => this.unwrap(r)), catchError(this.handle));
  }

  /** GET 文件下载（xlsx 等） */
  downloadGet(path: string, filename?: string, params?: Record<string, unknown>): Observable<void> {
    return this.http
      .get(`/api${path}`, { params: toParams(params), observe: 'response', responseType: 'blob' })
      .pipe(map((r) => this.save(r, filename)), catchError(this.handle));
  }

  /** POST 文件下载（导出类接口） */
  downloadPost(path: string, body?: unknown, filename?: string): Observable<void> {
    return this.http
      .post(`/api${path}`, body ?? {}, { observe: 'response', responseType: 'blob' })
      .pipe(map((r) => this.save(r, filename)), catchError(this.handle));
  }

  private unwrap<T>(res: ApiResponse<T> | null): T {
    if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
      if (res.success === false) {
        throw { code: res.code || 'error', message: res.message || '请求失败', status: 400 } as ApiError;
      }
      return res.data;
    }
    return res as unknown as T;
  }

  private save(res: HttpResponse<Blob>, filename?: string): void {
    const blob = res.body ?? new Blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    let name = filename ?? (match ? decodeURIComponent(match[1]) : `export-${Date.now()}`);
    if (!name.toLowerCase().endsWith('.xlsx') && !name.includes('.')) name += '.xlsx';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  private handle = (error: unknown) => {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { code?: string; message?: string } | null;
      const apiError: ApiError = {
        code: body?.code ?? (error.status === 0 ? 'network_error' : 'http_error'),
        message:
          body?.message ??
          (error.status === 0 ? '无法连接后端服务，请确认 API 已启动（http://localhost:5180）' : `请求失败（HTTP ${error.status}）`),
        status: error.status,
      };
      return throwError(() => apiError);
    }
    return throwError(() => error);
  };
}

export type { Paged };
