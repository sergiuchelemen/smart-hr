import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import {
  CategoryCount, DocumentVisibility, DocumentsService, LibraryDocument, TYPE_LABELS, VISIBILITY_LABELS, formatSize,
} from '../../core/documents/documents.service';
import { formatDate } from '../../shared/format/date';
import { DocumentDeleteDialog, DocumentFormDialog } from './document-dialogs';
import { DocumentPreviewDialog } from './document-preview';

type Status = 'loading' | 'ready' | 'error';

type Dialog =
  | { kind: 'form'; document: LibraryDocument | null }
  | { kind: 'delete'; document: LibraryDocument }
  | { kind: 'preview'; document: LibraryDocument };

@Component({
  selector: 'app-documente',
  imports: [
    FormsModule, TableModule, ButtonModule, InputTextModule, SelectModule, SkeletonModule, HasPermissionDirective,
    DocumentFormDialog, DocumentDeleteDialog, DocumentPreviewDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documente.html',
  styleUrl: './documente.scss',
})
export class DocumentePage implements OnInit {
  private readonly api = inject(DocumentsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly requests = new Subject<void>();
  private readonly searches = new Subject<void>();
  private focusKey: string | null = null;

  protected readonly canManage = computed(() => this.auth.hasPermission('DOCUMENT_MANAGE'));
  protected readonly status = signal<Status>('loading');
  protected readonly firstLoad = signal(true);
  protected readonly items = signal<LibraryDocument[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly first = computed(() => this.page() * this.size());
  protected readonly query = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly visibility = signal<DocumentVisibility | null>(null);
  protected readonly categories = signal<CategoryCount[]>([]);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly actionError = signal('');
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly visibilityOptions = [
    { label: 'Toți', value: null as DocumentVisibility | null },
    { label: VISIBILITY_LABELS.ALL, value: 'ALL' as DocumentVisibility | null },
    { label: VISIBILITY_LABELS.MANAGERS, value: 'MANAGERS' as DocumentVisibility | null },
    { label: VISIBILITY_LABELS.HR, value: 'HR' as DocumentVisibility | null },
  ];
  protected readonly totalCount = computed(() => this.categories().reduce((s, c) => s + c.count, 0));
  /** Filtrul „Vizibil pentru” se aplică pe documentele paginii curente (backend-ul nu are acest parametru). */
  protected readonly shown = computed(() => {
    const v = this.visibility();
    return v ? this.items().filter((d) => d.visibility === v) : this.items();
  });
  protected readonly filtered = computed(() => this.query().trim() !== '' || this.category() !== null || this.visibility() !== null);

  ngOnInit(): void {
    // O singură abonare: switchMap anulează cererea anterioară, contează doar ultimul răspuns.
    this.requests
      .pipe(
        switchMap(() =>
          this.api.list({ q: this.query(), category: this.category(), page: this.page(), size: this.size() }).pipe(
            catchError((err: unknown) => {
              if (err instanceof HttpErrorResponse && err.status === 403) {
                void this.router.navigateByUrl('/acces-interzis');
              } else {
                this.status.set('error');
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
        this.status.set('ready');
      });
    this.searches
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
    this.load();
    this.loadCategories();
  }

  private loadCategories(): void {
    this.api
      .categories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
  }

  protected load(): void {
    this.status.set('loading');
    this.requests.next();
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.searches.next();
  }

  protected onCategory(value: string | null): void {
    this.category.set(value);
    this.page.set(0);
    this.load();
  }

  protected onLazy(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.size();
    this.size.set(size);
    this.page.set(Math.floor((event.first ?? 0) / size));
    this.load();
  }

  protected typeLabel(d: LibraryDocument): string {
    return TYPE_LABELS[d.contentType] ?? '';
  }

  protected visLabel(d: LibraryDocument): string {
    return VISIBILITY_LABELS[d.visibility];
  }

  protected date(d: LibraryDocument): string {
    return formatDate(d.updatedAt.slice(0, 10));
  }

  protected sizeLabel(d: LibraryDocument): string {
    return formatSize(d.sizeBytes);
  }

  protected download(d: LibraryDocument): void {
    this.actionError.set('');
    this.api
      .download(d.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = d.fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url));
        },
        error: () => this.actionError.set('Nu am putut descărca documentul. Încearcă din nou.'),
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
      this.loadCategories();
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
}
