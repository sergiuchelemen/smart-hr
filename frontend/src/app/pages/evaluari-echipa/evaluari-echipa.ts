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
import {
  EVALUATION_STATUS_LABELS,
  EmployeeRef,
  EvaluationService,
  EvaluationStatus,
  TeamRow,
} from '../../core/evaluation/evaluation.service';
import { problemDetail } from '../../core/leave/leave.service';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { EvaluareDialog } from './evaluare-dialog';

type LoadState = 'loading' | 'ready' | 'error';

const ALL = 'ALL';

@Component({
  selector: 'app-evaluari-echipa',
  imports: [FormsModule, TableModule, ButtonModule, SelectModule, SkeletonModule, StatusPill, EvaluareDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluari-echipa.html',
  styleUrl: './evaluari-echipa.scss',
})
export class EvaluariEchipaPage implements OnInit {
  private readonly service = inject(EvaluationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<void>();
  private opener: HTMLElement | null = null;

  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly items = signal<TeamRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly firstLoad = signal(true);
  protected readonly cycleFilter = signal<string>(ALL);
  protected readonly statusFilter = signal<string>(ALL);
  protected readonly first = computed(() => this.page() * this.size());
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly selected = signal<TeamRow | null>(null);
  // Backend-ul nu oferă o listă de cicluri pentru evaluatori: opțiunile se adună din rândurile primite.
  private readonly knownCycles = signal<Map<string, string>>(new Map());
  protected readonly cycleOptions = computed(() => [
    { label: 'Toate ciclurile', value: ALL },
    ...[...this.knownCycles()].map(([value, label]) => ({ label, value })),
  ]);
  protected readonly statusOptions = [
    { label: 'Toate', value: ALL },
    ...(Object.keys(EVALUATION_STATUS_LABELS) as EvaluationStatus[]).map((s) => ({
      label: EVALUATION_STATUS_LABELS[s],
      value: s,
    })),
  ];
  protected readonly filtered = computed(() => this.cycleFilter() !== ALL || this.statusFilter() !== ALL);

  ngOnInit(): void {
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.loads
      .pipe(
        switchMap(() =>
          this.service
            .team({
              cycleId: this.cycleFilter() === ALL ? null : this.cycleFilter(),
              status: this.statusFilter() === ALL ? null : (this.statusFilter() as EvaluationStatus),
              page: this.page(),
              size: this.size(),
            })
            .pipe(
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
        if (res.items.length === 0 && res.totalElements > 0 && this.page() > 0) {
          this.page.set(Math.ceil(res.totalElements / this.size()) - 1);
          this.load();
          return;
        }
        const known = new Map(this.knownCycles());
        for (const r of res.items) {
          if (r.cycleName && !known.has(r.cycleId)) {
            known.set(r.cycleId, r.cycleName);
          }
        }
        this.knownCycles.set(known);
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

  protected onCycle(value: string): void {
    this.cycleFilter.set(value);
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

  protected pill(s: EvaluationStatus): `EV_${EvaluationStatus}` {
    return `EV_${s}`;
  }

  protected open(row: TeamRow, event: Event): void {
    this.opener = (event.target as HTMLElement | null)?.closest('button') ?? null;
    this.selected.set(row);
  }

  protected closeDialog(): void {
    this.selected.set(null);
    // returnează focusul pe butonul care a deschis dialogul
    setTimeout(() => this.opener?.focus());
  }
}
