import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { PlatformCompanyDetail, PlatformService } from '../../core/platform/platform.service';
import { problemDetail } from '../../core/leave/leave.service';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { AdminAddDialog } from './admin-add-dialog';

type Status = 'loading' | 'ready' | 'error';

const instantFormat = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

@Component({
  selector: 'app-platform-companie',
  imports: [RouterLink, ButtonModule, MessageModule, SkeletonModule, StatusPill, AdminAddDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-companie.html',
  styleUrl: './platform-companie.scss',
})
export class PlatformCompaniePage implements OnInit {
  private readonly platform = inject(PlatformService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSeq = 0;
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly status = signal<Status>('loading');
  protected readonly company = signal<PlatformCompanyDetail | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly notFound = signal(false);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly adminDialog = signal(false);
  protected readonly added = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected formatInstant(iso: string): string {
    return instantFormat.format(new Date(iso));
  }

  protected load(): void {
    const seq = ++this.loadSeq;
    this.status.set('loading');
    this.platform
      .company(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.company.set(c);
          this.status.set('ready');
        },
        error: (err: unknown) => {
          if (seq !== this.loadSeq) {
            return;
          }
          const http = err instanceof HttpErrorResponse ? err : null;
          this.notFound.set(http?.status === 404 || http?.status === 400);
          this.errorMessage.set(
            http?.status === 403
              ? 'Nu ai dreptul să vezi această companie.'
              : http?.status === 404 || http?.status === 400
                ? 'Compania căutată nu există.'
                : problemDetail(err),
          );
          this.company.set(null);
          this.status.set('error');
        },
      });
  }

  protected toggle(): void {
    const c = this.company();
    if (!c || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.platform
      .setEnabled(c.id, !c.enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.confirming.set(false);
          this.company.set(updated);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }

  protected onAdminClosed(added: boolean): void {
    this.adminDialog.set(false);
    this.added.set(added);
    if (added) {
      this.load();
    }
  }
}
