import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { AdminRole, AdminService, PermissionInfo } from '../../../core/admin/admin.service';
import { problemDetail } from '../../../core/leave/leave.service';
import { RoleDeleteDialog, RoleDialog } from './role-dialogs';

type Status = 'loading' | 'ready' | 'error';

type Dialog =
  | { kind: 'form'; role: AdminRole | null }
  | { kind: 'delete'; role: AdminRole };

@Component({
  selector: 'app-roluri',
  imports: [TableModule, ButtonModule, SkeletonModule, RoleDialog, RoleDeleteDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roluri.html',
  styleUrl: './roluri.scss',
})
export class RoluriPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private loadSeq = 0;
  private focusKey: string | null = null;

  protected readonly status = signal<Status>('loading');
  protected readonly firstLoad = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly roles = signal<AdminRole[]>([]);
  protected readonly catalog = signal<PermissionInfo[]>([]);
  protected readonly expanded = signal<Record<string, boolean>>({});
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  private readonly descriptions = computed(() => new Map(this.catalog().map((p) => [p.code, p.description])));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const seq = ++this.loadSeq;
    this.status.set('loading');
    forkJoin({ roles: this.admin.roles(), catalog: this.admin.permissions() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ roles, catalog }) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.roles.set(roles);
          this.catalog.set(catalog);
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

  protected toggle(id: string): void {
    this.expanded.update((m) => ({ ...m, [id]: !m[id] }));
  }

  protected describe(code: string): string {
    return this.descriptions().get(code) ?? code;
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

  protected editReason(r: AdminRole): string | null {
    if (r.system) {
      return 'Rolurile de sistem nu pot fi modificate.';
    }
    if (!r.editable) {
      return 'Nu poți modifica un rol propriu sau cu privilegii pe care nu le deții.';
    }
    return null;
  }

  protected deleteReason(r: AdminRole): string | null {
    const edit = this.editReason(r);
    if (edit) {
      return edit;
    }
    return r.userCount > 0 ? 'Rolul este atribuit unor utilizatori.' : null;
  }
}
