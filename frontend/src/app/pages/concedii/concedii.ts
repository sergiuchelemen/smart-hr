import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/auth/auth.service';
import { LeaveBalance, LeaveQuery, LeaveService, problemDetail } from '../../core/leave/leave.service';
import { LeaveRequests } from '../../shared/leave-requests/leave-requests';
import { NewLeaveRequestDialog } from './cerere-noua-dialog';

@Component({
  selector: 'app-concedii',
  imports: [ButtonModule, SkeletonModule, LeaveRequests, NewLeaveRequestDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concedii.html',
  styleUrl: './concedii.scss',
})
export class ConcediiPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly leave = inject(LeaveService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly balanceLoads = new Subject<void>();
  private readonly list = viewChild(LeaveRequests);
  private readonly newBtn = viewChild('newBtn', { read: ElementRef });

  protected readonly year = new Date().getFullYear();
  protected readonly hasEmployee = computed(() => this.auth.user()?.employee != null);
  protected readonly dialogOpen = signal(false);
  protected readonly balance = signal<LeaveBalance | null>(null);
  protected readonly balanceError = signal('');
  protected readonly total = computed(() => {
    const b = this.balance();
    return b ? b.entitled + b.carriedOver : 0;
  });

  protected readonly source = (q: LeaveQuery) => this.leave.mine(q);

  ngOnInit(): void {
    this.balanceLoads
      .pipe(
        switchMap(() =>
          this.leave.balance(this.year).pipe(
            catchError((err: unknown) => {
              if (err instanceof HttpErrorResponse && err.status === 403) {
                void this.router.navigateByUrl('/acces-interzis');
              } else {
                this.balanceError.set(problemDetail(err));
              }
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((b) => {
        this.balance.set(b);
        this.balanceError.set('');
      });
    if (this.hasEmployee()) {
      this.loadBalance();
    }
  }

  protected loadBalance(): void {
    this.balanceError.set('');
    this.balanceLoads.next();
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    // returnează focusul pe butonul care a deschis dialogul
    setTimeout(() => this.newBtn()?.nativeElement.querySelector('button')?.focus());
  }

  protected onCreated(): void {
    this.closeDialog();
    this.list()?.reload();
    this.loadBalance();
  }
}
