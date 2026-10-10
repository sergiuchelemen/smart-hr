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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { AdminRole, AdminService, AdminUser } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { problemDetail } from '../../../core/leave/leave.service';
import { StatusPill } from '../../../shared/status-pill/status-pill';
import { UserCreateDialog, UserEnabledDialog, UserPasswordDialog, UserRolesDialog } from './user-dialogs';

type Status = 'loading' | 'ready' | 'error';

type Dialog =
  | { kind: 'create' }
  | { kind: 'roles'; user: AdminUser }
  | { kind: 'password'; user: AdminUser }
  | { kind: 'enabled'; user: AdminUser; enable: boolean };

const PAGE_SIZE = 10;

@Component({
  selector: 'app-utilizatori',
  imports: [
    TableModule, ButtonModule, SkeletonModule, StatusPill,
    UserCreateDialog, UserRolesDialog, UserPasswordDialog, UserEnabledDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './utilizatori.html',
  styleUrl: './utilizatori.scss',
})
export class UtilizatoriPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private loadSeq = 0;
  private focusKey: string | null = null;

  protected readonly canManage = computed(() => this.auth.hasPermission('USER_MANAGE'));
  protected readonly status = signal<Status>('loading');
  protected readonly firstLoad = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly roles = signal<AdminRole[]>([]);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const seq = ++this.loadSeq;
    this.status.set('loading');
    forkJoin({
      users: this.admin.users(),
      roles: this.canManage() ? this.admin.roles() : of<AdminRole[]>([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ users, roles }) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.users.set(users);
          this.roles.set(roles);
          this.firstLoad.set(false);
          this.status.set('ready');
        },
        error: (err: unknown) => {
          if (seq !== this.loadSeq) {
            return;
          }
          if (err instanceof HttpErrorResponse && err.status === 403) {
            void this.router.navigateByUrl('/acces-interzis');
            return;
          }
          this.errorMessage.set(problemDetail(err));
          this.status.set('error');
        },
      });
  }

  protected open(dialog: Dialog, focusKey: string): void {
    this.focusKey = focusKey;
    this.dialog.set(dialog);
  }

  protected onClosed(refresh: boolean): void {
    this.dialog.set(null);
    if (refresh) {
      this.load();
    }
    const key = this.focusKey;
    this.focusKey = null;
    // returnează focusul pe butonul care a deschis dialogul (sau pe titlu dacă nu mai există)
    setTimeout(() => {
      const root = this.host.nativeElement;
      const target =
        root.querySelector<HTMLElement>(`[data-key="${key}"] button:not([disabled])`) ??
        root.querySelector<HTMLElement>('h1');
      target?.focus();
    });
  }

  protected reason(u: AdminUser): string | null {
    if (u.self) {
      return 'Nu poți modifica propriul cont.';
    }
    if (!u.manageable) {
      return 'Contul are drepturi mai mari decât ale tale.';
    }
    return null;
  }

  protected rolesLabel(u: AdminUser): string {
    return u.roles.length ? u.roles.map((r) => r.name).join(', ') : 'fără roluri';
  }
}
