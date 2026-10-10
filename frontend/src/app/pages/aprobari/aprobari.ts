import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LeaveQuery, LeaveService } from '../../core/leave/leave.service';
import { LeaveRequests } from '../../shared/leave-requests/leave-requests';

@Component({
  selector: 'app-aprobari',
  imports: [LeaveRequests],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1 class="t-title">Aprobări</h1>
      <p class="t-muted">{{ subtitle }}</p>
    </header>
    @if (source) {
      <app-leave-requests mode="review" [source]="source" [canDecide]="true" defaultStatus="PENDING" />
    } @else {
      <section class="panel state">
        <p class="t-heading">Nu poți vedea lista cererilor.</p>
        <p class="t-muted">Pentru a vedea cererile e nevoie de dreptul de a le citi pe toate sau de a aproba cererile echipei. Cere acces administratorului companiei.</p>
      </section>
    }
  `,
  styles: `
    .head { display: grid; gap: var(--space-1); margin-bottom: var(--space-5); }
    .state { padding: var(--space-6); display: grid; gap: var(--space-2); }
  `,
})
export class AprobariPage {
  private readonly auth = inject(AuthService);
  private readonly leave = inject(LeaveService);

  // Cu LEAVE_APPROVE_ALL și LEAVE_READ_ALL: toate cererile companiei; altfel, doar echipa (LEAVE_APPROVE).
  private readonly seesAll = this.auth.hasAll(['LEAVE_APPROVE_ALL', 'LEAVE_READ_ALL']);
  protected readonly source: ((q: LeaveQuery) => ReturnType<LeaveService['team']>) | null = this.seesAll
    ? (q) => this.leave.all(q)
    : this.auth.hasPermission('LEAVE_APPROVE')
      ? (q) => this.leave.team(q)
      : null;
  protected readonly subtitle = this.seesAll
    ? 'Cererile de concediu din companie, care așteaptă decizia ta.'
    : 'Cererile de concediu ale echipei tale.';
}
