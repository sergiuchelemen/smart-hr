import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { PlatformCompany, PlatformService } from '../../core/platform/platform.service';
import { problemDetail } from '../../core/leave/leave.service';
import { StatusPill } from '../../shared/status-pill/status-pill';
import { CompanyCreateDialog } from './company-create-dialog';

type Status = 'loading' | 'ready' | 'error';

const instantFormat = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

@Component({
  selector: 'app-platform-companii',
  imports: [RouterLink, TableModule, ButtonModule, SkeletonModule, StatusPill, CompanyCreateDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-companii.html',
  styleUrl: './platform-companii.scss',
})
export class PlatformCompaniiPage implements OnInit {
  private readonly platform = inject(PlatformService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private loadSeq = 0;

  protected readonly status = signal<Status>('loading');
  protected readonly firstLoad = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly companies = signal<PlatformCompany[]>([]);
  protected readonly dialogOpen = signal(false);
  protected readonly pageSize = 10;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

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
      .companies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.companies.set(list);
          this.firstLoad.set(false);
          this.status.set('ready');
        },
        error: (err: unknown) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.errorMessage.set(
            err instanceof HttpErrorResponse && err.status === 403
              ? 'Nu ai dreptul să vezi companiile platformei.'
              : problemDetail(err),
          );
          this.status.set('error');
        },
      });
  }

  protected onClosed(changed: boolean): void {
    this.dialogOpen.set(false);
    if (changed) {
      this.load();
    }
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus());
  }
}
