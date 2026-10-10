import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../core/auth/auth.service';
import { problemDetail } from '../../core/leave/leave.service';
import {
  EmployeeRef,
  TIMESHEET_STATUS_LABELS,
  TeamQuery,
  TeamRow,
  TimesheetService,
  TimesheetStatus,
  formatMinutes,
} from '../../core/timesheet/timesheet.service';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { AngajatPontajDialog } from './angajat-dialog';

type LoadState = 'loading' | 'ready' | 'error';

const ALL = 'ALL';

@Component({
  selector: 'app-pontaj-echipa',
  imports: [FormsModule, TableModule, ButtonModule, SelectModule, SkeletonModule, StatusPill, AngajatPontajDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pontaj-echipa.html',
  styleUrl: './pontaj-echipa.scss',
})
export class PontajEchipaPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly timesheet = inject(TimesheetService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<void>();

  // READ_ALL sau APPROVE_ALL: toată compania (/all); altfel doar echipa (/team).
  private readonly seesAll = this.auth.hasAny(['TIMESHEET_READ_ALL', 'TIMESHEET_APPROVE_ALL']);
  private readonly mayDecide = this.auth.hasAny(['TIMESHEET_APPROVE', 'TIMESHEET_APPROVE_ALL']);

  protected readonly subtitle = this.seesAll
    ? 'Pontajele lunare ale angajaților din companie.'
    : 'Pontajele lunare ale echipei tale.';

  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly items = signal<TeamRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly firstLoad = signal(true);
  protected readonly monthFilter = signal<string>(this.monthOptionsList()[0].value);
  protected readonly statusFilter = signal<string>('SUBMITTED');
  protected readonly first = computed(() => this.page() * this.size());
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly selected = signal<TeamRow | null>(null);

  protected readonly monthOptions = this.monthOptionsList();
  protected readonly statusOptions = [
    { label: 'Toate', value: ALL },
    ...(Object.keys(TIMESHEET_STATUS_LABELS) as TimesheetStatus[]).map((s) => ({
      label: s === 'SUBMITTED' ? 'Trimis spre aprobare' : TIMESHEET_STATUS_LABELS[s],
      value: s,
    })),
  ];
  protected readonly filtered = computed(() => this.statusFilter() !== 'SUBMITTED' || this.monthFilter() !== this.monthOptions[0].value);

  ngOnInit(): void {
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.loads
      .pipe(
        switchMap(() => {
          const q: TeamQuery = {
            month: this.monthFilter(),
            status: this.statusFilter() === ALL ? null : (this.statusFilter() as TimesheetStatus),
            page: this.page(),
            size: this.size(),
          };
          const call = this.seesAll ? this.timesheet.all(q) : this.timesheet.team(q);
          return call.pipe(
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

  protected onMonth(value: string): void {
    this.monthFilter.set(value);
    this.page.set(0);
    this.load();
  }

  protected onStatus(value: string): void {
    this.statusFilter.set(value);
    this.page.set(0);
    this.load();
  }

  protected name(e: EmployeeRef): string {
    return `${e.firstName} ${e.lastName}`;
  }

  protected minutes(value: number): string {
    return formatMinutes(value);
  }

  protected pill(s: TimesheetStatus): `TS_${TimesheetStatus}` {
    return `TS_${s}`;
  }

  /** Fără decizie pe pontajul propriu (backend-ul îl refuză oricum cu 403). */
  protected canDecideOn(row: TeamRow): boolean {
    return this.mayDecide && row.employee.id !== this.auth.user()?.employee?.id;
  }

  protected onChanged(): void {
    this.selected.set(null);
    this.load();
  }

  private monthOptionsList(): { label: string; value: string }[] {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const text = fmt.format(d);
      return {
        label: text.charAt(0).toUpperCase() + text.slice(1),
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      };
    });
  }
}
