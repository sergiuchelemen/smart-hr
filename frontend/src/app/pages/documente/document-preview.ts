import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { DocumentsService, LibraryDocument, TYPE_LABELS, formatSize } from '../../core/documents/documents.service';
import { formatDate } from '../../shared/format/date';

type State = 'loading' | 'ready' | 'error';

/** Previzualizare PDF (object) sau TXT (text simplu). Conținutul nu se loghează și nu se inserează ca HTML. */
@Component({
  selector: 'app-document-preview-dialog',
  imports: [ButtonModule, DialogModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || closed.emit()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="true" [header]="document().title"
              [style]="{ width: '62rem', height: '86vh' }" [breakpoints]="{ '960px': '96vw' }"
              [contentStyle]="{ display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' }">
      <div class="meta">
        <span class="t-body-sm t-muted">{{ info() }}</span>
        <p-button label="Descarcă" size="small" severity="secondary" [outlined]="true" [loading]="downloading()"
                  [ariaLabel]="'Descarcă ' + document().title" (onClick)="download()" />
      </div>
      <div class="body" [attr.aria-busy]="state() === 'loading'">
        @switch (state()) {
          @case ('loading') {
            <div class="loading" aria-label="Se încarcă documentul">
              <p-skeleton width="80%" height="16px" />
              <p-skeleton width="60%" height="16px" />
              <p-skeleton width="70%" height="16px" />
            </div>
          }
          @case ('error') {
            <p class="msg" role="alert">{{ error() }}</p>
          }
          @default {
            @if (pdfUrl(); as url) {
              <!-- <object> si nu <iframe sandbox>: vizualizatorul PDF din Chrome nu porneste intr-un iframe cu sandbox. -->
              <object class="pdf" type="application/pdf" [attr.data]="url" [attr.aria-label]="'Previzualizare ' + document().title">
                <p class="msg">Browserul nu poate afișa PDF-ul aici. Folosește butonul „Descarcă”.</p>
              </object>
            } @else {
              <pre class="txt" tabindex="0" [attr.aria-label]="'Conținutul documentului ' + document().title">{{ text() }}</pre>
            }
          }
        }
      </div>
      <ng-template #footer>
        <p-button label="Închide" severity="secondary" [text]="true" (onClick)="closed.emit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .meta { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
    .body { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--surface-sunken); border-radius: var(--radius-field); overflow: hidden; }
    .loading { display: grid; gap: var(--space-3); padding: var(--space-5); }
    .msg { padding: var(--space-5); margin: 0; }
    .pdf { flex: 1; width: 100%; min-height: 24rem; border: 0; }
    .txt { flex: 1; margin: 0; padding: var(--space-5); overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); background: var(--surface-raised); font: 13px/20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .txt:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
  `,
})
export class DocumentPreviewDialog implements OnInit, OnDestroy {
  private readonly api = inject(DocumentsService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private objectUrl: string | null = null;

  readonly document = input.required<LibraryDocument>();
  readonly closed = output<void>();

  protected readonly state = signal<State>('loading');
  protected readonly error = signal('');
  protected readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  protected readonly text = signal('');
  protected readonly downloading = signal(false);

  protected info(): string {
    const d = this.document();
    return `${TYPE_LABELS[d.contentType] ?? ''}, ${formatSize(d.sizeBytes)}, actualizat ${formatDate(d.updatedAt.slice(0, 10))}`;
  }

  ngOnInit(): void {
    const d = this.document();
    this.api
      .content(d.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (blob) => {
          if (d.contentType === 'application/pdf') {
            // Tipul este fixat la application/pdf, indiferent de ce declară răspunsul.
            const pdf = new Blob([blob], { type: 'application/pdf' });
            this.objectUrl = URL.createObjectURL(pdf);
            // Singurul loc cu ocolire de sanitizare: URL-ul blob creat mai sus, cu tip PDF fix.
            this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
          } else {
            this.text.set(await blob.text());
          }
          this.state.set('ready');
        },
        error: (err: unknown) => {
          this.error.set(
            err instanceof HttpErrorResponse && err.status === 404
              ? 'Documentul nu mai este disponibil.'
              : 'Nu am putut încărca documentul. Încearcă din nou.',
          );
          this.state.set('error');
        },
      });
  }

  ngOnDestroy(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  protected download(): void {
    const d = this.document();
    this.downloading.set(true);
    this.api
      .download(d.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = window.document.createElement('a');
          a.href = url;
          a.download = d.fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url));
          this.downloading.set(false);
        },
        error: () => {
          this.downloading.set(false);
          this.error.set('Nu am putut descărca documentul. Încearcă din nou.');
          this.state.set('error');
        },
      });
  }
}
