import { Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { AuthService } from './auth.service';

export interface RealtimeEvent {
  type: string;
  payload: unknown;
  at: number;
}

/** SignalR 实时通道（/hubs/notifications）：用于告警/审批/工单等即时刷新，失败静默降级为轮询
 * 注：后端 Hub 需要 JwtBearer 支持从 query string 读取 access_token 才能握手成功，
 * 当前后端未配置，故默认关闭（页面已用轮询刷新）；后端就绪后将 ENABLE_REALTIME 置为 true 即可。 */
const ENABLE_REALTIME = false;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private connection?: HubConnection;
  private readonly eventSignal = signal<RealtimeEvent | null>(null);

  readonly lastEvent = this.eventSignal.asReadonly();
  readonly connected = signal(false);

  start(): void {
    if (!ENABLE_REALTIME) return;
    if (this.connection || !this.auth.accessToken) return;
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', { accessTokenFactory: () => this.auth.accessToken ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.None)
      .build();

    const handler = (type: string) => (payload: unknown) => {
      this.eventSignal.set({ type, payload, at: Date.now() });
    };
    connection.on('notification', handler('notification'));
    connection.on('alert', handler('alert'));
    connection.on('order', handler('order'));
    connection.on('flightPlan', handler('flightPlan'));
    connection.onreconnected(() => this.connected.set(true));
    connection.onclose(() => this.connected.set(false));

    connection
      .start()
      .then(() => this.connected.set(true))
      .catch(() => this.connected.set(false));
    this.connection = connection;
  }

  stop(): void {
    void this.connection?.stop();
    this.connection = undefined;
    this.connected.set(false);
  }
}
