import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { Evaluation, EvaluationService, EvaluationStatus, formatScore } from '../../core/evaluation/evaluation.service';
import { problemDetail } from '../../core/leave/leave.service';
import { ReviewForm, reviewValid } from '../../shared/score-scale/review-form';
import { StatusPill } from '../../shared/status-pill/status-pill';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-evaluare-dialog',
  imports: [ButtonModule, DialogModule, MessageModule, SkeletonModule, ReviewForm, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="title()"
              [style]="{ width: '60rem' }" [breakpoints]="{ '960px': '94vw' }">
      @if (state() === 'error') {
        <div class="state" role="alert">
          <p class="t-muted">{{ loadError() }}</p>
          <div><p-button label="Încearcă din nou" severity="secondary" [outlined]="true" (onClick)="load()" /></div>
        </div>
      } @else if (data(); as d) {
        <div class="body">
          <div class="meta">
            <span class="t-body-sm"><strong>{{ d.cycle.name }}</strong></span>
            <app-status-pill [status]="pill(d.status)" />
          </div>

          <section class="part" aria-labelledby="ev-self-titlu">
            <h3 class="t-heading" id="ev-self-titlu">Autoevaluarea angajatului</h3>
            @if (d.self) {
              <app-review-form [criteria]="d.cycle.criteria" idPrefix="ev-self" [readonly]="true"
                               [scores]="d.self.scores" [comment]="d.self.comment ?? ''" />
            } @else {
              <p class="t-muted">Autoevaluarea nu a fost trimisă încă.</p>
            }
          </section>

          <section class="part" aria-labelledby="ev-mgr-titlu">
            <h3 class="t-heading" id="ev-mgr-titlu">Evaluarea managerului</h3>
            @if (d.status === 'COMPLETED' && d.manager) {
              <p class="final">
                <span class="t-label t-muted">Scor final</span>
                <span class="value num">{{ d.finalScore != null ? score(d.finalScore) : '-' }}</span>
                <span class="t-body-sm t-muted">din 5</span>
              </p>
              <app-review-form [criteria]="d.cycle.criteria" idPrefix="ev-mgr-ro" [readonly]="true"
                               [scores]="d.manager.scores" [comment]="d.manager.comment ?? ''" />
            } @else if (d.locked || d.cycle.status !== 'OPEN') {
              <p class="t-muted">Evaluarea este blocată: ciclul a fost închis înainte de finalizare.</p>
            } @else {
              <app-review-form [criteria]="d.cycle.criteria" idPrefix="ev-mgr" [(scores)]="scores"
                               [(comment)]="comment" [disabled]="busy()" [showErrors]="showErrors()" />
              @if (confirming()) {
                <p-message severity="warn" role="alert">
                  Trimiți evaluarea? După trimitere nu mai poate fi modificată.
                </p-message>
              }
            }
          </section>

          @if (error()) {
            <p-message severity="error" role="alert">{{ error() }}</p-message>
          }
        </div>
      } @else {
        <div aria-busy="true" aria-label="Se încarcă evaluarea"><p-skeleton width="100%" height="22rem" /></div>
      }
      <ng-template #footer>
        @if (editable()) {
          @if (confirming()) {
            <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="confirming.set(false)" />
            <p-button label="Confirmă trimiterea" [loading]="busy()" (onClick)="send()" />
          } @else {
            <p-button label="Închide" severity="secondary" [text]="true" (onClick)="close()" />
            <p-button label="Trimite evaluarea" (onClick)="review()" />
          }
        } @else {
          <p-button label="Închide" severity="secondary" [text]="true" (onClick)="close()" />
        }
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .body { display: grid; gap: var(--space-5); }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
    .part { display: grid; gap: var(--space-3); }
    .part h3, .part p { margin: 0; }
    .state { display: grid; gap: var(--space-3); }
    .final { display: flex; align-items: baseline; gap: var(--space-3); }
    .value { font-size: 28px; line-height: 34px; font-weight: 600; color: var(--brand-ink); }
  `,
})
export class EvaluareDialog implements OnInit {
  private readonly service = inject(EvaluationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly evaluationId = input.required<string>();
  readonly employeeName = input.required<string>();
  readonly changed = output<void>();
  readonly closed = output<void>();

  protected readonly data = signal<Evaluation | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal('');
  protected readonly scores = signal<Record<string, number>>({});
  protected readonly comment = signal('');
  protected readonly showErrors = signal(false);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly title = computed(() => `Evaluare: ${this.employeeName()}`);
  protected readonly editable = computed(() => {
    const d = this.data();
    return d != null && d.status !== 'COMPLETED' && !d.locked && d.cycle.status === 'OPEN';
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.service
      .get(this.evaluationId())
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

  protected pill(s: EvaluationStatus): `EV_${EvaluationStatus}` {
    return `EV_${s}`;
  }

  protected score(v: number): string {
    return formatScore(v);
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected review(): void {
    const d = this.data();
    if (!d) {
      return;
    }
    this.showErrors.set(true);
    this.error.set('');
    this.confirming.set(reviewValid(d.cycle.criteria, this.scores(), this.comment()));
  }

  protected send(): void {
    const d = this.data();
    if (!d || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const comment = this.comment().trim();
    this.service
      .managerReview(d.id, { scores: this.scores(), comment: comment || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.data.set(updated);
          this.busy.set(false);
          this.confirming.set(false);
          this.changed.emit();
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
