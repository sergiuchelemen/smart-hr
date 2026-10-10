import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LeaveQuery, LeaveService } from '../../core/leave/leave.service';
import { LeaveRequests } from '../../shared/leave-requests/leave-requests';

@Component({
  selector: 'app-toate-cererile',
  imports: [LeaveRequests],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1 class="t-title">Toate cererile</h1>
      <p class="t-muted">Cererile de concediu ale tuturor angajaților companiei.</p>
    </header>
    <app-leave-requests mode="review" [source]="source" [canDecide]="canDecide" [showYearFilter]="true" />
  `,
  styles: `
    .head { display: grid; gap: var(--space-1); margin-bottom: var(--space-5); }
  `,
})
export class ToateCererilePage {
  private readonly leave = inject(LeaveService);
  protected readonly canDecide = inject(AuthService).hasPermission('LEAVE_APPROVE_ALL');
  protected readonly source = (q: LeaveQuery) => this.leave.all(q);
}
