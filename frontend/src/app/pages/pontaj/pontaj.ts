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
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { problemDetail } from '../../core/leave/leave.service';
import { EntryInput, TimesheetMonth, TimesheetService, formatMinutes } from '../../core/timesheet/timesheet.service';
import { toIsoDate } from '../../shared/format/date';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { TimesheetCalendar, isEditableDate } from '../../shared/timesheet-calendar/timesheet-calendar';
import { ZiDialog } from './zi-dialog';

type LoadState = 'loading' | 'ready' | 'error';

const FILL_MINUTES = 480;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-pontaj',
  imports: [ButtonModule, DialogModule, MessageModule, SkeletonModule, StatusPill, TimesheetCalendar, ZiDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pontaj.html',
  styleUrl: './pontaj.scss',
})
export class PontajPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly timesheet = inject(TimesheetService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<void>();
  private readonly currentMonth = monthKey(new Date());

  protected readonly hasEmployee = computed(() => this.auth.user()?.employee != null);
  protected readonly month = signal(this.currentMonth);
  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly data = signal<TimesheetMonth | null>(null);
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly confirmSubmit = signal(false);
  protected readonly busy = signal(false);
  protected readonly actionError = signal('');
  protected readonly actionInfo = signal('');

  protected readonly isCurrent = computed(() => this.month() === this.currentMonth);
  protected readonly canEdit = computed(() => {
    const s = this.data()?.status;
    return s === 'DRAFT' || s === 'REJECTED';
  });
  protected readonly selectedEntry = computed(
    () => this.data()?.days.find((d) => d.date === this.selectedDate()) ?? null,
  );
  protected readonly monthLabel = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    const text = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
  protected readonly pillStatus = computed(() => `TS_${this.data()?.status ?? 'DRAFT'}` as const);
  protected readonly worked = computed(() => formatMinutes(this.data()?.summary.workedMinutes ?? 0));
  protected readonly norm = computed(() => formatMinutes(this.data()?.summary.normMinutes ?? 0));

  ngOnInit(): void {
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.loads
      .pipe(
        switchMap(() =>
          this.timesheet.mine(this.month()).pipe(
            catchError((err: unknown) => {
              if (err instanceof HttpErrorResponse && err.status === 403) {
                void this.router.navigateByUrl('/acces-interzis');
              } else {
                this.errorMessage.set(problemDetail(err));
                this.state.set('error');
              }
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.data.set(res);
        this.state.set('ready');
      });
    if (this.hasEmployee()) {
      this.load();
    }
  }

  protected load(): void {
    this.state.set('loading');
    this.loads.next();
  }

  protected shiftMonth(delta: number): void {
    const [y, m] = this.month().split('-').map(Number);
    this.month.set(monthKey(new Date(y, m - 1 + delta, 1)));
    this.actionError.set('');
    this.actionInfo.set('');
    this.data.set(null);
    this.load();
  }

  protected openDay(date: string): void {
    this.actionError.set('');
    this.actionInfo.set('');
    this.selectedDate.set(date);
  }

  protected onDayChanged(): void {
    this.selectedDate.set(null);
    this.load();
  }

  /** O singură cerere PUT cu zilele lucrătoare editabile și încă necompletate din săptămâna curentă. */
  protected fillWeek(): void {
    const d = this.data();
    if (!d || this.busy()) {
      return;
    }
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    const entries: EntryInput[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = toIsoDate(day);
      const existing = d.days.find((x) => x.date === iso);
      if (!existing || existing.blocked || existing.minutes !== null || !isEditableDate(day, today)) {
        continue;
      }
      entries.push({ date: iso, minutes: FILL_MINUTES, type: 'LUCRAT', note: null });
    }
    this.actionError.set('');
    this.actionInfo.set('');
    if (entries.length === 0) {
      this.actionInfo.set('Nu există zile de completat în săptămâna curentă.');
      return;
    }
    this.busy.set(true);
    this.timesheet
      .save(entries)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.load();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.actionError.set(problemDetail(err));
        },
      });
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set('');
    this.timesheet
      .submit(this.month())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.confirmSubmit.set(false);
          this.load();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.confirmSubmit.set(false);
          this.actionError.set(problemDetail(err));
          this.load();
        },
      });
  }
}
