import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Employee, EmployeesService } from '../../core/employees/employees.service';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { formatDate } from '../../shared/format/date';
import {
  EmployeeAccountDialog, EmployeeBalanceDialog, EmployeeFormDialog, EmployeeManagerDialog, employeeName,
} from './employee-dialogs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';

type Status = 'loading' | 'ready' | 'error';

type Dialog =
  | { kind: 'form'; employee: Employee | null }
  | { kind: 'account'; employee: Employee }
  | { kind: 'manager'; employee: Employee }
  | { kind: 'balance'; employee: Employee };

@Component({
  selector: 'app-angajati',
  imports: [
    TableModule, ButtonModule, SkeletonModule, HasPermissionDirective,
    EmployeeFormDialog, EmployeeAccountDialog, EmployeeManagerDialog, EmployeeBalanceDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './angajati.html',
  styleUrl: './angajati.scss',
})
export class AngajatiPage implements OnInit {
  private readonly api = inject(EmployeesService);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private focusKey: string | null = null;
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<void>();

  protected readonly status = signal<Status>('loading');
  protected readonly items = signal<Employee[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly firstLoad = signal(true);
  protected readonly first = computed(() => this.page() * this.size());
  protected readonly directory = signal<Employee[]>([]);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly ownId = computed(() => this.auth.user()?.employee?.id ?? null);
  protected readonly names = computed(() => new Map(this.directory().map((e) => [e.id, employeeName(e)])));
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.requests
      .pipe(
        switchMap(() => {
          return this.api.page(this.page(), this.size()).pipe(
            catchError((err: unknown) => {
              if (err instanceof HttpErrorResponse && err.status === 403) {
                void this.router.navigateByUrl('/acces-interzis');
              } else {
                this.status.set('error');
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res.items.length === 0 && res.totalElements > 0 && this.page() > 0) {
          // pagina cerută depășește ultima pagină: cere ultima pagină validă
          this.page.set(Math.ceil(res.totalElements / this.size()) - 1);
          this.load();
          return;
        }
        this.items.set(res.items);
        this.total.set(res.totalElements);
        this.firstLoad.set(false);
        this.status.set('ready');
      });
    this.load();
    this.loadDirectory();
  }

  private loadDirectory(): void {
    // Lista completă (pagini de câte 100) pentru numele managerilor și selectoare.
    this.api
      .all()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (all) => this.directory.set(all), error: () => undefined });
  }

  protected onLazy(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.size();
    this.size.set(size);
    this.page.set(Math.floor((event.first ?? 0) / size));
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.requests.next();
  }

  protected fullName(e: Employee): string {
    return employeeName(e);
  }

  protected formatDate(iso: string | null): string {
    return iso ? formatDate(iso) : '';
  }

  protected managerName(e: Employee): string {
    return e.managerId ? (this.names().get(e.managerId) ?? 'Necunoscut') : '';
  }

  protected isOwn(e: Employee): boolean {
    return e.id === this.ownId();
  }

  protected can(...perms: string[]): boolean {
    return this.auth.hasAll(perms);
  }

  protected ownReason(e: Employee): string | null {
    return this.isOwn(e) ? 'Nu poți modifica propriul angajat.' : null;
  }

  protected open(dialog: Dialog, focusKey: string): void {
    this.focusKey = focusKey;
    this.dialog.set(dialog);
  }

  protected onClosed(refresh: boolean): void {
    this.dialog.set(null);
    if (refresh) {
      this.load();
      this.loadDirectory();
    }
    const key = this.focusKey;
    this.focusKey = null;
    // focusul revine pe butonul care a deschis dialogul (sau pe titlu dacă nu mai există)
    setTimeout(() => {
      const root = this.host.nativeElement;
      const target =
        root.querySelector<HTMLElement>(`[data-key="${key}"] button:not([disabled])`) ??
        root.querySelector<HTMLElement>('h1');
      target?.focus();
    });
  }
}
