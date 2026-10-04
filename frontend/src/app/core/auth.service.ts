import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResultDto, AuthUserDto, LogoutRequest, RefreshRequest } from './api-types';

const STORAGE_KEY = 'dubhe.auth';

interface StoredAuth {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: AuthUserDto;
}

/** 登录态（JWT + 用户 + 权限），PC 端令牌 8 小时，滑动续期由拦截器负责 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly state = signal<StoredAuth | null>(this.restore());

  readonly user = computed(() => this.state()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this.state()?.accessToken);
  readonly roles = computed(() => this.state()?.user.roles ?? []);
  readonly permissions = computed(() => this.state()?.user.permissions ?? []);
  readonly displayName = computed(() => this.state()?.user.displayName ?? '');
  readonly isAdmin = computed(() => this.roles().includes('Admin'));

  get accessToken(): string | null {
    return this.state()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.state()?.refreshToken ?? null;
  }

  /** 最近一次活跃时间（会话超时控制） */
  private lastActiveAt = Date.now();

  touch(): void {
    this.lastActiveAt = Date.now();
  }

  idleMinutes(): number {
    return (Date.now() - this.lastActiveAt) / 60000;
  }

  login(account: string, password: string): Observable<AuthResultDto> {
    return this.api.post<AuthResultDto>('/auth/login', { account, password }).pipe(tap((r) => this.persist(r)));
  }

  /** 注册仅返回账号信息（不发令牌），企业/商家账号需管理员审核后登录 */
  register(body: {
    username: string;
    phone: string;
    password: string;
    displayName: string;
    userType: number;
    companyName?: string | null;
  }): Observable<AuthUserDto> {
    return this.api.post<AuthUserDto>('/auth/register', body);
  }

  refresh(): Observable<AuthResultDto> {
    const token = this.refreshToken;
    if (!token) throw new Error('no refresh token');
    return this.api
      .post<AuthResultDto>('/auth/refresh', { refreshToken: token } as RefreshRequest)
      .pipe(tap((r) => this.persist(r)));
  }

  /** 服务端返回新的用户信息时同步（如更新资料后） */
  patchUser(user: Partial<AuthUserDto>): void {
    const current = this.state();
    if (!current) return;
    this.setState({ ...current, user: { ...current.user, ...user } });
  }

  logout(callServer = true): void {
    const token = this.refreshToken;
    if (callServer && token) {
      this.api.post<void>('/auth/logout', { refreshToken: token } as LogoutRequest).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
    }
    this.setState(null);
    void this.router.navigate(['/auth/login']);
  }

  private persist(result: AuthResultDto): void {
    this.setState({
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.refreshToken,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      user: result.user,
    });
    this.lastActiveAt = Date.now();
  }

  private setState(value: StoredAuth | null): void {
    this.state.set(value);
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  }

  private restore(): StoredAuth | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredAuth;
      if (!parsed?.accessToken || !parsed?.user) return null;
      if (parsed.refreshTokenExpiresAt && new Date(parsed.refreshTokenExpiresAt).getTime() < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
