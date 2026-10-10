import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import {
  Evaluation,
  EvaluationService,
  EvaluationStatus,
  formatScore,
  formatTrend,
} from '../../core/evaluation/evaluation.service';
import { problemDetail } from '../../core/leave/leave.service';
import { formatDate } from '../../shared/format/date';
import { ReviewForm, reviewValid } from '../../shared/score-scale/review-form';
import { StatusPill } from '../../shared/status-pill/status-pill';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-evaluarile-mele',
  imports: [ButtonModule, MessageModule, SkeletonModule, ReviewForm, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluarile-mele.html',
  styleUrl: './evaluarile-mele.scss',
})
export class EvaluarileMelePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly service = inject(EvaluationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<void>();

  protected readonly hasEmployee = computed(() => this.auth.user()?.employee != null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly items = signal<Evaluation[]>([]);

  protected readonly current = computed(() => this.items().find((e) => e.cycle.status === 'OPEN') ?? null);
  protected readonly history = computed(() =>
    this.items()
      .filter((e) => e.cycle.status === 'CLOSED')
      .sort((a, b) => b.cycle.endDate.localeCompare(a.cycle.endDate)),
  );

  protected readonly scores = signal<Record<string, number>>({});
  protected readonly comment = signal('');
  protected readonly confirming = signal(false);
  protected readonly showErrors = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly justSent = signal(false);

  ngOnInit(): void {
    if (!this.hasEmployee()) {
      return;
    }
    this.loads
      .pipe(
        switchMap(() =>
          this.service.mine().pipe(
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
        this.items.set(res);
        this.state.set('ready');
      });
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.loads.next();
  }

  protected isSent(e: Evaluation): boolean {
    return e.self?.submittedAt != null || e.status !== 'PENDING_SELF';
  }

  protected pill(s: EvaluationStatus): `EV_${EvaluationStatus}` {
    return `EV_${s}`;
  }

  protected period(e: Evaluation): string {
    return `${formatDate(e.cycle.startDate)} - ${formatDate(e.cycle.endDate)}`;
  }

  protected score(v: number | null): string {
    return v == null ? '' : formatScore(v);
  }

  protected trend(v: number): string {
    return formatTrend(v);
  }

  protected scoreOf(review: Evaluation['self'], key: string): string {
    const v = review?.scores?.[key];
    return v ? `${v} din 5` : '-';
  }

  protected review(e: Evaluation): void {
    this.showErrors.set(true);
    if (!reviewValid(e.cycle.criteria, this.scores(), this.comment())) {
      this.confirming.set(false);
      return;
    }
    this.confirming.set(true);
  }

  protected send(e: Evaluation): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const comment = this.comment().trim();
    this.service
      .selfReview(e.id, { scores: this.scores(), comment: comment || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
          this.busy.set(false);
          this.confirming.set(false);
          this.justSent.set(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.confirming.set(false);
          this.error.set(problemDetail(err));
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.load();
          }
        },
      });
  }
}
