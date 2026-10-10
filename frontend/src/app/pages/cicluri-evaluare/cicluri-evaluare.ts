import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { CycleStatus, Cycle, EvaluationService } from '../../core/evaluation/evaluation.service';
import { problemDetail } from '../../core/leave/leave.service';
import { formatDate } from '../../shared/format/date';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { CicluDialog } from './ciclu-dialog';
import { ProgresDialog } from './progres-dialog';

type LoadState = 'loading' | 'ready' | 'error';
type Action = 'open' | 'close';

const CONFIRM_TEXT: Record<Action, string> = {
  open: 'Se vor crea evaluări pentru angajații cu cont și manager. Ciclul nu mai poate fi editat.',
  close: 'După închidere angajații văd rezultatele și evaluările necompletate se blochează.',
};

@Component({
  selector: 'app-cicluri-evaluare',
  imports: [TableModule, ButtonModule, MessageModule, SkeletonModule, StatusPill, CicluDialog, ProgresDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cicluri-evaluare.html',
  styleUrl: './cicluri-evaluare.scss',
})
export class CicluriEvaluarePage implements OnInit {
  private readonly service = inject(EvaluationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<void>();
  private readonly newBtn = viewChild('newBtn', { read: ElementRef });
  private opener: HTMLElement | null = null;

  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly items = signal<Cycle[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly firstLoad = signal(true);
  protected readonly first = computed(() => this.page() * this.size());
  protected readonly skeletonRows = [1, 2, 3];

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Cycle | null>(null);
  protected readonly progressFor = signal<Cycle | null>(null);
  protected readonly pending = signal<{ cycle: Cycle; action: Action } | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal('');

  ngOnInit(): void {
    this.loads
      .pipe(
        switchMap(() =>
          this.service.cycles(this.page(), this.size()).pipe(
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

  protected pill(s: CycleStatus): `CY_${CycleStatus}` {
    return `CY_${s}`;
  }

  protected period(c: Cycle): string {
    return `${formatDate(c.startDate)} - ${formatDate(c.endDate)}`;
  }

  protected confirmText(): string {
    const c = this.pending();
    return c ? CONFIRM_TEXT[c.action] : '';
  }

  protected openForm(cycle: Cycle | null, event?: Event): void {
    this.opener = (event?.target as HTMLElement | null)?.closest('button') ?? null;
    this.editing.set(cycle);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.focusOpener(this.opener ?? this.newBtn()?.nativeElement.querySelector('button') ?? null);
  }

  protected onSaved(): void {
    this.closeForm();
    this.load();
  }

  protected openProgress(cycle: Cycle, event: Event): void {
    this.opener = (event.target as HTMLElement | null)?.closest('button') ?? null;
    this.progressFor.set(cycle);
  }

  protected closeProgress(): void {
    this.progressFor.set(null);
    this.focusOpener(this.opener);
    this.load();
  }

  protected ask(cycle: Cycle, action: Action): void {
    this.actionError.set('');
    this.pending.set({ cycle, action });
  }

  protected run(): void {
    const c = this.pending();
    if (!c || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set('');
    const call = c.action === 'open' ? this.service.open(c.cycle.id) : this.service.close(c.cycle.id);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.pending.set(null);
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.pending.set(null);
        this.actionError.set(problemDetail(err));
        this.load();
      },
    });
  }

  private focusOpener(el: HTMLElement | null): void {
    // returnează focusul pe butonul care a deschis dialogul
    setTimeout(() => el?.focus());
  }
}
