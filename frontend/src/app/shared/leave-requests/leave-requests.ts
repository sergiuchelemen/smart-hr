import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../core/auth/auth.service';
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  LeavePage,
  LeaveQuery,
  LeaveRequest,
  LeaveService,
  LeaveStatus,
  problemDetail,
} from '../../core/leave/leave.service';
import { formatDate, toIsoDate } from '../format/date';
import { StatusPill } from '../status-pill/status-pill';

type LoadState = 'loading' | 'ready' | 'error';
type ActionKind = 'cancel' | 'approve' | 'reject';

const ALL = 'ALL';
const REASON_MAX = 500;

@Component({
  selector: 'app-leave-requests',
  imports: [
    FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, MessageModule, SelectModule,
    SkeletonModule, TextareaModule, StatusPill,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-requests.html',
  styleUrl: './leave-requests.scss',
})
export class LeaveRequests implements OnInit {
  private readonly leave = inject(LeaveService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<void>();

  /** Sursa paginată de cereri (apelează endpoint-ul potrivit paginii). */
  readonly source = input.required<(q: LeaveQuery) => Observable<LeavePage>>();
  readonly mode = input.required<'mine' | 'review'>();
  readonly canDecide = input(false);
  readonly showYearFilter = input(false);
  readonly defaultStatus = input<LeaveStatus | null>(null);
  /** Rulează după o acțiune reușită (anulare, aprobare, respingere). */
  readonly changed = output<void>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly items = signal<LeaveRequest[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly firstLoad = signal(true);
  protected readonly statusFilter = signal<string>(ALL);
  protected readonly yearFilter = signal<number>(0);
  protected readonly first = computed(() => this.page() * this.size());
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly showEmployee = computed(() => this.mode() === 'review');
  protected readonly showActions = computed(() => this.mode() === 'mine' || this.canDecide());
  protected readonly filtered = computed(
    () => this.statusFilter() !== (this.defaultStatus() ?? ALL) || this.yearFilter() !== 0,
  );

  protected readonly statusOptions = [
    { label: 'Toate', value: ALL },
    ...(Object.keys(LEAVE_STATUS_LABELS) as LeaveStatus[]).map((s) => ({ label: LEAVE_STATUS_LABELS[s], value: s })),
  ];
  protected readonly yearOptions = (() => {
    const current = new Date().getFullYear();
    return [
      { label: 'Toți anii', value: 0 },
      ...[current + 1, current, current - 1, current - 2].map((y) => ({ label: String(y), value: y })),
    ];
  })();

  protected readonly emptyTitle = computed(() => {
    if (this.filtered()) {
      return 'Nicio cerere nu corespunde filtrelor.';
    }
    if (this.defaultStatus() === 'PENDING') {
      return 'Nu ai cereri de aprobat.';
    }
    return this.mode() === 'mine' ? 'Nu ai nicio cerere de concediu.' : 'Nu există cereri de afișat.';
  });
  protected readonly emptyHint = computed(() => {
    if (this.filtered()) {
      return 'Schimbă starea sau anul ca să vezi alte cereri.';
    }
    if (this.defaultStatus() === 'PENDING') {
      return 'Cererile care așteaptă decizia ta apar aici.';
    }
    return this.mode() === 'mine'
      ? 'Apasă Cerere nouă ca să trimiți prima cerere.'
      : 'Cererile trimise de angajați apar aici.';
  });

  // Dialog de acțiune (anulare, aprobare, respingere), în pagină.
  protected readonly action = signal<{ kind: ActionKind; request: LeaveRequest } | null>(null);
  protected readonly actionError = signal('');
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly reasonMax = REASON_MAX;
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(REASON_MAX)],
  });
  protected readonly reasonLength = signal(0);

  protected readonly dialogTitle = computed(() => {
    switch (this.action()?.kind) {
      case 'cancel':
        return 'Anulezi cererea?';
      case 'approve':
        return 'Aprobi cererea?';
      default:
        return 'Respingi cererea';
    }
  });
  protected readonly confirmLabel = computed(() => {
    switch (this.action()?.kind) {
      case 'cancel':
        return 'Anulează cererea';
      case 'approve':
        return 'Aprobă cererea';
      default:
        return 'Respinge cererea';
    }
  });

  constructor() {
    this.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.reasonLength.set(v.length));
  }

  ngOnInit(): void {
    this.statusFilter.set(this.defaultStatus() ?? ALL);
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.loads
      .pipe(
        switchMap(() => {
          const q: LeaveQuery = {
            status: this.statusFilter() === ALL ? null : (this.statusFilter() as LeaveStatus),
            year: this.yearFilter() === 0 ? null : this.yearFilter(),
            page: this.page(),
            size: this.size(),
          };
          return this.source()(q).pipe(
            catchError((err: unknown) => {
              if (err instanceof HttpErrorResponse && err.status === 403) {
                void this.router.navigateByUrl('/acces-interzis');
              } else {
                this.errorMessage.set(problemDetail(err));
                this.state.set('error');
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.items.length === 0 && res.totalElements > 0 && this.page() > 0) {
          this.page.set(Math.ceil(res.totalElements / this.size()) - 1);
          this.load();
          return;
        }
        this.items.set(res.items);
        this.total.set(res.totalElements);
        this.firstLoad.set(false);
        this.state.set('ready');
      });
    this.load();
  }

  /** Reîncarcă pagina curentă (apelat și din pagina părinte). */
  reload(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.loads.next();
  }

  protected onLazy(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.size();
    this.size.set(size);
    this.page.set(Math.floor((event.first ?? 0) / size));
    this.load();
  }

  protected onStatus(value: string): void {
    this.statusFilter.set(value);
    this.page.set(0);
    this.load();
  }

  protected onYear(value: number): void {
    this.yearFilter.set(value);
    this.page.set(0);
    this.load();
  }

  protected typeLabel(r: LeaveRequest): string {
    return LEAVE_TYPE_LABELS[r.type];
  }

  protected employeeName(r: LeaveRequest): string {
    return `${r.employee.firstName} ${r.employee.lastName}`;
  }

  protected period(r: LeaveRequest): string {
    return r.startDate === r.endDate
      ? formatDate(r.startDate)
      : `${formatDate(r.startDate)} până la ${formatDate(r.endDate)}`;
  }

  /** Același criteriu ca în backend: în așteptare, sau aprobată cu începutul în viitor. */
  protected canCancel(r: LeaveRequest): boolean {
    return r.status === 'PENDING' || (r.status === 'APPROVED' && r.startDate > toIsoDate(new Date()));
  }

  /** Fără decizie pe cererile proprii (backend-ul le refuză oricum cu 403). */
  protected canDecideOn(r: LeaveRequest): boolean {
    return this.canDecide() && r.status === 'PENDING' && r.employee.id !== this.auth.user()?.employee?.id;
  }

  protected hasActions(r: LeaveRequest): boolean {
    return this.mode() === 'mine' ? this.canCancel(r) : this.canDecideOn(r);
  }

  protected openAction(kind: ActionKind, request: LeaveRequest): void {
    this.reason.reset('');
    this.submitted.set(false);
    this.actionError.set('');
    this.action.set({ kind, request });
  }

  protected closeAction(): void {
    if (this.busy()) {
      return;
    }
    this.action.set(null);
  }

  protected submitAction(): void {
    const current = this.action();
    if (!current || this.busy()) {
      return;
    }
    let call: Observable<LeaveRequest>;
    if (current.kind === 'reject') {
      this.submitted.set(true);
      if (this.reason.invalid) {
        return;
      }
      call = this.leave.reject(current.request.id, this.reason.value.trim());
    } else if (current.kind === 'approve') {
      call = this.leave.approve(current.request.id);
    } else {
      call = this.leave.cancel(current.request.id);
    }
    this.busy.set(true);
    this.actionError.set('');
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.action.set(null);
        this.load();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.actionError.set(problemDetail(err));
        // starea cererii s-ar putea să se fi schimbat între timp
        this.load();
      },
    });
  }
}
