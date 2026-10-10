import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  jobTitle: string | null;
  department: string | null;
  hireDate: string | null;
}

interface PageResponse {
  items: Employee[];
  page: number;
  size: number;
  totalElements: number;
}

type Status = 'loading' | 'ready' | 'error';

const dateFormat = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

@Component({
  selector: 'app-angajati',
  imports: [TableModule, ButtonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './angajati.html',
  styleUrl: './angajati.scss',
})
export class AngajatiPage implements OnInit {
  private readonly http = inject(HttpClient);
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
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.requests
      .pipe(
        switchMap(() => {
          const params = new HttpParams().set('page', this.page()).set('size', this.size());
          return this.http.get<PageResponse>('/api/employees', { params }).pipe(
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
    return `${e.firstName} ${e.lastName}`;
  }

  protected formatDate(iso: string | null): string {
    if (!iso) {
      return '';
    }
    const [y, m, d] = iso.split('-').map(Number);
    return dateFormat.format(new Date(y, m - 1, d));
  }
}
