import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { AuthService } from '../../core/auth/auth.service';
import { problemDetail } from '../../core/leave/leave.service';
import { Department, OrgService, Position, flattenDepartments } from '../../core/org/org.service';
import { DepartmentDialog, OrgDeleteDialog, PositionDialog } from './org-dialogs';

type Status = 'loading' | 'ready' | 'error';

type Dialog =
  | { kind: 'department'; department: Department | null }
  | { kind: 'position'; position: Position | null }
  | { kind: 'delete-department'; department: Department }
  | { kind: 'delete-position'; position: Position };

@Component({
  selector: 'app-organizatie',
  imports: [TableModule, TabsModule, ButtonModule, SkeletonModule, DepartmentDialog, PositionDialog, OrgDeleteDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organizatie.html',
  styleUrl: './organizatie.scss',
})
export class OrganizatiePage implements OnInit {
  private readonly org = inject(OrgService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private loadSeq = 0;
  private focusKey: string | null = null;

  protected readonly canManage = computed(() => this.auth.hasPermission('ORG_MANAGE'));
  protected readonly tab = signal<string>('departamente');
  protected readonly status = signal<Status>('loading');
  protected readonly firstLoad = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly departments = signal<Department[]>([]);
  protected readonly positions = signal<Position[]>([]);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly nodes = computed(() => flattenDepartments(this.departments()));
  protected readonly sortedPositions = computed(() =>
    [...this.positions()].sort((a, b) => a.name.localeCompare(b.name, 'ro')),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const seq = ++this.loadSeq;
    this.status.set('loading');
    forkJoin({ departments: this.org.departments(), positions: this.org.positions() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ departments, positions }) => {
          if (seq !== this.loadSeq) {
            return;
          }
          this.departments.set(departments);
          this.positions.set(positions);
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

  protected setTab(value: string | number | undefined): void {
    this.tab.set(String(value ?? 'departamente'));
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
    setTimeout(() => {
      const root = this.host.nativeElement;
      const target =
        root.querySelector<HTMLElement>(`[data-key="${key}"] button:not([disabled])`) ??
        root.querySelector<HTMLElement>('h1');
      target?.focus();
    });
  }

  protected departmentDeleteReason(d: Department): string | null {
    if (d.employeeCount > 0) {
      return 'Departamentul are angajați.';
    }
    if (d.childCount > 0) {
      return 'Departamentul are subdepartamente.';
    }
    return null;
  }

  protected positionDeleteReason(p: Position): string | null {
    return p.employeeCount > 0 ? 'Postul este atribuit unor angajați.' : null;
  }
}
