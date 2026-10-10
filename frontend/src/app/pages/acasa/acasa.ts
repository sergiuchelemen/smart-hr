import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { Dashboard, DashboardService } from '../../core/dashboard/dashboard.service';
import { formatMinutes } from '../../core/timesheet/timesheet.service';
import { BarItem, BarList } from '../../shared/charts/bar-list';
import { DonutGauge } from '../../shared/charts/donut-gauge';
import { MonthBars } from '../../shared/charts/month-bars';
import { WeekStrip } from '../../shared/charts/week-strip';
import { StatusPill } from '../../shared/status-pill/status-pill';

type LoadState = 'loading' | 'ready' | 'error';

interface Attention {
  key: string;
  count: number | null;
  label: string;
  link: string;
}

const TOP_DEPARTMENTS = 8;
const dayFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const docDate = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
const monthName = new Intl.DateTimeFormat('ro-RO', { month: 'short' });

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'app-acasa',
  imports: [RouterLink, ButtonModule, SkeletonModule, HasPermissionDirective, StatusPill, DonutGauge, BarList, MonthBars, WeekStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './acasa.html',
  styleUrl: './acasa.scss',
})
export class AcasaPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<LoadState>('loading');
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly today = new Date();
  protected readonly dateText = longDate.format(this.today);
  protected readonly month = this.today.getMonth() + 1;
  protected readonly year = this.today.getFullYear();

  protected readonly firstName = computed(() => this.data()?.me?.firstName ?? this.auth.user()?.employee?.firstName ?? null);
  protected readonly company = computed(() => this.data()?.me?.companyName ?? this.auth.user()?.company.name ?? '');

  protected readonly attention = computed<Attention[]>(() => {
    const d = this.data();
    if (!d) {
      return [];
    }
    const out: Attention[] = [];
    const a = d.approvals;
    if (a?.leavePending) {
      out.push({ key: 'l', count: a.leavePending, label: a.leavePending === 1 ? 'Concediu de aprobat' : 'Concedii de aprobat', link: '/aprobari' });
    }
    if (a?.timesheetSubmitted) {
      out.push({ key: 't', count: a.timesheetSubmitted, label: a.timesheetSubmitted === 1 ? 'Pontaj de aprobat' : 'Pontaje de aprobat', link: '/pontaj-echipa' });
    }
    if (a?.evaluationsPending) {
      out.push({ key: 'e', count: a.evaluationsPending, label: a.evaluationsPending === 1 ? 'Evaluare de făcut' : 'Evaluări de făcut', link: '/evaluari-echipa' });
    }
    if (d.evaluation?.status === 'PENDING_SELF') {
      out.push({ key: 'se', count: null, label: `Evaluarea ta: ${d.evaluation.cycleName}`, link: '/evaluarile-mele' });
    }
    const ts = d.timesheet?.status;
    if (ts === 'DRAFT' || ts === 'REJECTED') {
      out.push({ key: 'tm', count: null, label: ts === 'REJECTED' ? 'Pontajul lunii a fost respins' : 'Pontajul lunii nu e trimis', link: '/pontaj' });
    }
    return out;
  });
  protected readonly checkedApprovals = computed(() => this.data()?.approvals != null);

  protected readonly leave = computed(() => {
    const l = this.data()?.leaveBalance;
    if (!l) {
      return null;
    }
    const total = l.entitled + l.carriedOver;
    const next = l.nextApprovedLeave;
    const nextText = next
      ? next.startDate === next.endDate
        ? dayFmt.format(parse(next.startDate))
        : `${dayFmt.format(parse(next.startDate))} - ${dayFmt.format(parse(next.endDate))}`
      : null;
    return {
      total,
      available: l.available,
      used: l.used,
      pending: l.pending,
      segments: [
        { value: l.used, token: 'border-strong' },
        { value: l.pending, token: 'warning' },
        { value: Math.max(l.available, 0), token: 'brand' },
      ],
      nextText,
      description: `Concediu: ${l.available} zile disponibile din ${total}, ${l.used} folosite, ${l.pending} în așteptare.`,
      myPending: l.myPendingRequests,
    };
  });

  protected readonly sheet = computed(() => {
    const t = this.data()?.timesheet;
    if (!t) {
      return null;
    }
    const pct = t.normMinutes > 0 ? Math.min((t.workedMinutes / t.normMinutes) * 100, 100) : 0;
    const [y, m] = t.month.split('-').map(Number);
    const label = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    return {
      worked: formatMinutes(t.workedMinutes),
      norm: formatMinutes(t.normMinutes),
      pct,
      label,
      pill: `TS_${t.status}` as const,
    };
  });

  protected readonly absences = computed(() => {
    const a = this.data()?.absences;
    if (!a) {
      return null;
    }
    const items = a.items.map((i) => ({ name: i.employeeName, from: i.from, to: i.to }));
    return {
      items,
      today: a.onLeaveToday,
      description: `Absențe în această săptămână: ${items.map((i) => `${i.name}, ${i.from} - ${i.to}`).join('; ') || 'nimeni'}.`,
    };
  });

  protected readonly headcount = computed(() => {
    const h = this.data()?.headcount;
    if (!h) {
      return null;
    }
    const sorted = [...h.byDepartment].sort((a, b) => b.count - a.count);
    const bars: BarItem[] = sorted.slice(0, TOP_DEPARTMENTS).map((d) => ({ label: d.name, value: d.count }));
    const rest = sorted.slice(TOP_DEPARTMENTS).reduce((s, d) => s + d.count, 0);
    if (rest > 0) {
      bars.push({ label: 'Altele', value: rest });
    }
    return { total: h.total, hired: h.hiredLast90Days, bars };
  });

  protected readonly byMonth = computed(() => {
    const m = this.data()?.leaveByMonth;
    if (!m) {
      return null;
    }
    const total = m.reduce((s, x) => s + x.days, 0);
    return {
      data: m,
      total,
      description: `Zile de concediu pe luni în ${this.year}: ${m.map((x) => `${monthName.format(new Date(this.year, x.month - 1, 1))} ${x.days}`).join(', ')}.`,
    };
  });

  protected readonly holidays = computed(() =>
    (this.data()?.upcomingHolidays ?? []).slice(0, 3).map((h) => {
      const d = parse(h.date);
      return { day: d.getDate(), mon: monthName.format(d).replace('.', ''), name: h.name };
    }),
  );
  protected readonly hasHolidays = computed(() => this.data()?.upcomingHolidays != null);

  protected readonly docs = computed(() =>
    (this.data()?.recentDocuments ?? []).slice(0, 3).map((d) => ({ ...d, date: docDate.format(new Date(d.updatedAt)) })),
  );
  protected readonly hasDocs = computed(() => this.data()?.recentDocuments != null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.service
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }
}
