import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { problemDetail } from '../../core/leave/leave.service';
import { EmployeeRef, TimesheetMonth, TimesheetService, formatMinutes } from '../../core/timesheet/timesheet.service';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { TimesheetCalendar } from '../../shared/timesheet-calendar/timesheet-calendar';

type Mode = 'view' | 'approve' | 'reject';
type LoadState = 'loading' | 'ready' | 'error';

const REASON_MAX = 500;

@Component({
  selector: 'app-angajat-pontaj-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, MessageModule, SkeletonModule, TextareaModule, StatusPill, TimesheetCalendar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="title()"
              [style]="{ width: '56rem' }" [breakpoints]="{ '960px': '94vw' }">
      @if (state() === 'error') {
        <div class="state" role="alert">
          <p class="t-muted">{{ loadError() }}</p>
          <div><p-button label="Încearcă din nou" severity="secondary" [outlined]="true" (onClick)="load()" /></div>
        </div>
      } @else if (data(); as d) {
        <div class="body">
          <div class="meta">
            <app-status-pill [status]="pillStatus()" />
            <span class="t-body-sm t-muted">Ore lucrate: <span class="num">{{ worked() }}</span> din normă <span class="num">{{ norm() }}</span></span>
            <span class="t-body-sm t-muted">Concediu: <span class="num">{{ d.summary.leaveDays }}</span> zile</span>
            <span class="t-body-sm t-muted">Sărbători: <span class="num">{{ d.summary.holidayDays }}</span></span>
            <span class="t-body-sm t-muted">Absențe: <span class="num">{{ d.summary.absentDays }}</span></span>
          </div>
          @if (d.status === 'REJECTED' && d.rejectionReason) {
            <p-message severity="error">Motiv respingere: {{ d.rejectionReason }}</p-message>
          }
          <app-timesheet-calendar [month]="month()" [days]="d.days" [editable]="false" />

          @if (mode() === 'approve') {
            <p-message severity="warn" role="alert">Aprobi pontajul pentru {{ monthLabel() }}? Decizia nu poate fi anulată.</p-message>
          }
          @if (mode() === 'reject') {
            <div class="field">
              <label class="t-label" for="pontaj-motiv">Motiv</label>
              <textarea pTextarea id="pontaj-motiv" rows="3" [formControl]="reason" [fluid]="true"
                        [invalid]="submitted() && reason.invalid" aria-describedby="pontaj-motiv-ajutor"></textarea>
              <p id="pontaj-motiv-ajutor" class="t-body-sm" [class.err]="submitted() && reason.invalid"
                 [class.t-muted]="!(submitted() && reason.invalid)">
                @if (submitted() && reason.hasError('maxlength')) {
                  Motivul poate avea cel mult {{ reasonMax }} de caractere.
                } @else if (submitted() && reason.invalid) {
                  Motivul este obligatoriu.
                } @else {
                  Obligatoriu. Angajatul va vedea acest motiv.
                }
                <span class="num count">{{ reasonLength() }}/{{ reasonMax }}</span>
              </p>
            </div>
          }
          @if (error()) {
            <p-message severity="error" role="alert">{{ error() }}</p-message>
          }
        </div>
      } @else {
        <div aria-busy="true" aria-label="Se încarcă pontajul"><p-skeleton width="100%" height="22rem" /></div>
      }
      <ng-template #footer>
        @if (mode() === 'view') {
          <p-button label="Închide" severity="secondary" [text]="true" (onClick)="close()" />
          @if (canDecideNow()) {
            <p-button label="Respinge" severity="secondary" [outlined]="true" (onClick)="startReject()" />
            <p-button label="Aprobă" (onClick)="mode.set('approve')" />
          }
        } @else {
          <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="mode.set('view')" />
          @if (mode() === 'approve') {
            <p-button label="Aprobă pontajul" [loading]="busy()" (onClick)="approve()" />
          } @else {
            <p-button label="Respinge pontajul" [loading]="busy()" (onClick)="reject()" />
          }
        }
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .body { display: grid; gap: var(--space-4); }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
    .state { display: grid; gap: var(--space-3); }
    .field { display: grid; gap: var(--space-1); }
    .err { color: var(--danger-ink); }
    .count { float: right; }
  `,
})
export class AngajatPontajDialog implements OnInit {
  private readonly timesheet = inject(TimesheetService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly employee = input.required<EmployeeRef>();
  readonly month = input.required<string>();
  /** Are privilegiul de decizie și nu este pontajul propriu. */
  readonly canDecide = input(false);
  readonly changed = output<void>();
  readonly closed = output<void>();

  protected readonly data = signal<TimesheetMonth | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal('');
  protected readonly mode = signal<Mode>('view');
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly reasonMax = REASON_MAX;
  protected readonly reasonLength = signal(0);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(REASON_MAX)],
  });

  protected readonly title = computed(() => `Pontaj: ${this.employee().firstName} ${this.employee().lastName}`);
  protected readonly monthLabel = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  });
  protected readonly pillStatus = computed(() => `TS_${this.data()?.status ?? 'DRAFT'}` as const);
  protected readonly worked = computed(() => formatMinutes(this.data()?.summary.workedMinutes ?? 0));
  protected readonly norm = computed(() => formatMinutes(this.data()?.summary.normMinutes ?? 0));
  protected readonly canDecideNow = computed(() => this.canDecide() && this.data()?.status === 'SUBMITTED');

  constructor() {
    this.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.reasonLength.set(v.length));
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.timesheet
      .employee(this.employee().id, this.month())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 403) {
            void this.router.navigateByUrl('/acces-interzis');
            return;
          }
          this.loadError.set(problemDetail(err));
          this.state.set('error');
        },
      });
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected startReject(): void {
    this.reason.reset('');
    this.submitted.set(false);
    this.error.set('');
    this.mode.set('reject');
  }

  protected approve(): void {
    this.decide(this.timesheet.approve(this.employee().id, this.month()));
  }

  protected reject(): void {
    this.submitted.set(true);
    if (this.reason.invalid) {
      return;
    }
    this.decide(this.timesheet.reject(this.employee().id, this.month(), this.reason.value.trim()));
  }

  private decide(call: ReturnType<TimesheetService['approve']>): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(problemDetail(err));
        this.mode.set('view');
        // starea s-ar putea să se fi schimbat între timp
        this.load();
      },
    });
  }
}
