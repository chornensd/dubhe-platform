import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { AtcDashboardPage } from '../reports/dashboard-atc';
import { AdminDashboardPage } from '../reports/dashboard-admin';
import { MerchantDashboardPage } from '../reports/dashboard-merchant';
import { CustomerWorkbenchPage } from './customer-workbench';

/** 工作台入口：按角色渲染对应看板 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (kind()) {
      @case ('admin') {
        <ng-container *ngComponentOutlet="adminDash" />
      }
      @case ('atc') {
        <ng-container *ngComponentOutlet="atcDash" />
      }
      @case ('merchant') {
        <ng-container *ngComponentOutlet="merchantDash" />
      }
      @default {
        <ng-container *ngComponentOutlet="customerDash" />
      }
    }
  `,
})
export class DashboardPage {
  private readonly auth = inject(AuthService);

  readonly adminDash = AdminDashboardPage;
  readonly merchantDash = MerchantDashboardPage;
  readonly atcDash = AtcDashboardPage;
  readonly customerDash = CustomerWorkbenchPage;

  readonly kind = signal<'admin' | 'merchant' | 'atc' | 'customer'>(this.resolve());

  private resolve(): 'admin' | 'merchant' | 'atc' | 'customer' {
    const roles = this.auth.roles();
    if (roles.includes('Admin')) return 'admin';
    if (roles.includes('AirTrafficController')) return 'atc';
    if (roles.some((r) => ['Merchant', 'Dispatcher', 'Finance', 'Operator', 'OperationsStaff'].includes(r))) return 'merchant';
    if (roles.includes('Customer')) return 'customer';
    return 'merchant';
  }
}
