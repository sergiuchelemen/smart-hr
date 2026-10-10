import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { EmployeesService } from '../../core/employees/employees.service';
import {
  Cycle,
  EmployeeRef,
  EvaluationService,
  EvaluationStatus,
  Progress,
  ProgressRow,
  formatScore,
} from '../../core/evaluation/evaluation.service';
import { problemDetail } from '../../core/leave/leave.service';
import { StatusPill } from '../../shared/status-pill/status-pill';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-progres-dialog',
  imports: [FormsModule, ButtonModule, DialogModule, MessageModule, SelectModule, SkeletonModule, TableModule, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [header]="'Progres: ' + cycle().name"
              [style]="{ width: '62rem' }" [breakpoints]="{ '960px': '94vw' }">
      @if (state() === 'error') {
        <div class="state" role="alert">
          <p class="t-muted">{{ loadError() }}</p>
          <div><p-button label="Încearcă din nou" severity="secondary" [outlined]="true" (onClick)="load()" /></div>
        </div>
      } @else if (data(); as d) {
        <div class="body" [attr.aria-busy]="state() === 'loading'">
          <dl class="counts">
            <div><dt class="t-label t-muted">În așteptare autoevaluare</dt><dd class="num">{{ d.counts.pendingSelf }}</dd></div>
            <div><dt class="t-label t-muted">În așteptarea managerului</dt><dd class="num">{{ d.counts.pendingManager }}</dd></div>
            <div><dt class="t-label t-muted">Finalizate</dt><dd class="num">{{ d.counts.completed }}</dd></div>
            <div><dt class="t-label t-muted">Blocate</dt><dd class="num">{{ d.counts.locked }}</dd></div>
            <div><dt class="t-label t-muted">Excluși</dt><dd class="num">{{ d.excludedCount }}</dd></div>
          </dl>
          @if (d.excludedCount > 0) {
            <p class="t-body-sm t-muted">
              Excluși: angajații fără cont sau fără manager nu primesc evaluare în acest ciclu.
              @if (d.excluded.length) {
                Printre ei: {{ excludedNames(d.excluded) }}.
              }
            </p>
          }

          @if (reassigning(); as r) {
            <section class="panel reassign" aria-labelledby="reasign-titlu">
              <h3 class="t-heading" id="reasign-titlu">Reasignează evaluatorul pentru {{ name(r.employee) }}</h3>
              <div class="field">
                <label class="t-label" for="reasign-select">Evaluator nou</label>
                <p-select inputId="reasign-select" [options]="reviewerOptions()" optionLabel="label" optionValue="value"
                          [ngModel]="newReviewer()" (ngModelChange)="newReviewer.set($event)" [filter]="true"
                          filterPlaceholder="Caută angajat" [loading]="employeesLoading()" appendTo="body"
                          placeholder="Alege angajatul" emptyMessage="Niciun angajat cu cont" [fluid]="true" />
                <p class="t-body-sm t-muted">Poate fi evaluator doar un angajat cu cont, diferit de cel evaluat.</p>
              </div>
              @if (reassignError()) {
                <p-message severity="error" role="alert">{{ reassignError() }}</p-message>
              }
              <div class="actions">
                <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="cancelReassign()" />
                <p-button label="Salvează evaluatorul" severity="secondary" [outlined]="true" [loading]="busy()"
                          [disabled]="!newReviewer()" (onClick)="saveReassign()" />
              </div>
            </section>
          }

          <p-table [value]="d.items" [lazy]="true" [lazyLoadOnInit]="false" (onLazyLoad)="onLazy($event)"
                   [paginator]="true" [rows]="size()" [first]="page() * size()" [totalRecords]="d.totalElements"
                   [rowsPerPageOptions]="[10, 20, 50]" dataKey="id" [showCurrentPageReport]="true"
                   currentPageReportTemplate="{first} - {last} din {totalRecords}" [tableStyle]="{ 'min-width': '40rem' }">
            <ng-template #header>
              <tr>
                <th scope="col">Angajat</th>
                <th scope="col">Evaluator</th>
                <th scope="col">Stare</th>
                <th scope="col">Scor final</th>
                <th scope="col">Acțiuni</th>
              </tr>
            </ng-template>
            <ng-template #body let-r>
              <tr>
                <td>{{ name(r.employee) }}</td>
                <td>{{ r.reviewer ? name(r.reviewer) : '-' }}</td>
                <td>
                  <app-status-pill [status]="pill(r.status)" />
                  @if (r.locked) { <span class="t-body-sm t-muted"> (blocată)</span> }
                </td>
                <td class="num">{{ r.finalScore != null ? score(r.finalScore) : '-' }}</td>
                <td>
                  @if (canReassign(r)) {
                    <p-button class="row-action" label="Reasignează evaluatorul" size="small" severity="secondary"
                              [outlined]="true" [ariaLabel]="'Reasignează evaluatorul pentru ' + name(r.employee)"
                              (onClick)="startReassign(r)" />
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      } @else {
        <div aria-busy="true" aria-label="Se încarcă progresul"><p-skeleton width="100%" height="18rem" /></div>
      }
      <ng-template #footer>
        <p-button label="Închide" severity="secondary" [text]="true" (onClick)="close()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .body { display: grid; gap: var(--space-4); }
    .state { display: grid; gap: var(--space-3); }
    .counts { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: var(--space-4); }
    .counts dt, .counts dd { margin: 0; }
    .counts dd { font-size: 24px; line-height: 30px; font-weight: 600; }
    .body p, .reassign h3 { margin: 0; }
    .reassign { padding: var(--space-4); display: grid; gap: var(--space-3); }
    .field { display: grid; gap: var(--space-1); }
    .field p { margin: 0; }
    .actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
  `,
})
export class ProgresDialog implements OnInit {
  private readonly service = inject(EvaluationService);
  private readonly employees = inject(EmployeesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly cycle = input.required<Cycle>();
  readonly closed = output<void>();

  protected readonly data = signal<Progress | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly busy = signal(false);
  protected readonly reassigning = signal<ProgressRow | null>(null);
  protected readonly newReviewer = signal<string | null>(null);
  protected readonly reassignError = signal('');
  protected readonly employeesLoading = signal(false);
  private readonly people = signal<{ id: string; label: string }[] | null>(null);
  protected readonly reviewerOptions = computed(() => {
    const r = this.reassigning();
    return (this.people() ?? [])
      .filter((p) => p.id !== r?.employee.id)
      .map((p) => ({ label: p.label, value: p.id }));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.service
      .progress(this.cycle().id, this.page(), this.size())
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

  protected onLazy(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.size();
    const page = Math.floor((event.first ?? 0) / size);
    if (size === this.size() && page === this.page()) {
      return;
    }
    this.size.set(size);
    this.page.set(page);
    this.load();
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected name(e: EmployeeRef): string {
    return `${e.firstName} ${e.lastName}`;
  }

  protected excludedNames(list: EmployeeRef[]): string {
    return list.map((e) => this.name(e)).join(', ');
  }

  protected pill(s: EvaluationStatus): `EV_${EvaluationStatus}` {
    return `EV_${s}`;
  }

  protected score(v: number): string {
    return formatScore(v);
  }

  protected canReassign(r: ProgressRow): boolean {
    return r.status !== 'COMPLETED' && !r.locked && this.cycle().status === 'OPEN';
  }

  protected startReassign(r: ProgressRow): void {
    this.reassigning.set(r);
    this.newReviewer.set(null);
    this.reassignError.set('');
    if (this.people() === null && !this.employeesLoading()) {
      this.employeesLoading.set(true);
      this.employees
        .all()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (all) => {
            this.people.set(
              all.filter((e) => e.userId).map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` })),
            );
            this.employeesLoading.set(false);
          },
          error: (err: unknown) => {
            this.employeesLoading.set(false);
            this.reassignError.set(problemDetail(err));
          },
        });
    }
  }

  protected cancelReassign(): void {
    this.reassigning.set(null);
  }

  protected saveReassign(): void {
    const r = this.reassigning();
    const target = this.newReviewer();
    if (!r || !target || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.reassignError.set('');
    this.service
      .reassign(r.id, target)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.reassigning.set(null);
          this.load();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.reassignError.set(problemDetail(err));
        },
      });
  }
}
