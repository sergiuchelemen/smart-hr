import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { problemDetail } from '../../core/leave/leave.service';
import {
  CategoryCount, DocumentVisibility, DocumentsService, LibraryDocument, MAX_FILE_BYTES, UploadEvent, VISIBILITY_LABELS,
  formatSize,
} from '../../core/documents/documents.service';

const STYLES = `
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: var(--space-1); }
  .err { color: var(--danger-ink); }
  .drop { border: 1px dashed var(--border-strong); border-radius: var(--radius-card); padding: var(--space-5) var(--space-4); text-align: center; color: var(--ink-muted); background: var(--surface); display: grid; gap: var(--space-2); justify-items: center; }
  .drop.over { border-color: var(--brand); background: var(--brand-tint); }
  .drop strong { color: var(--ink); }
  .hidden-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .warn { background: var(--warning-tint); color: var(--warning-ink); border-radius: var(--radius-field); padding: var(--space-3); }
  .prog { height: 6px; background: var(--surface-sunken); border-radius: var(--radius-pill); overflow: hidden; }
  .prog i { display: block; height: 100%; background: var(--brand); border-radius: var(--radius-pill); }
  .replace { display: grid; gap: var(--space-2); border-top: 1px solid var(--border); padding-top: var(--space-4); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
`;

function notBlank(c: AbstractControl<string>): ValidationErrors | null {
  return (c.value ?? '').trim() ? null : { required: true };
}

/** Oglindește backend-ul: doar .pdf/.txt, cel mult 10 MB. Întoarce mesajul de eroare sau null. */
export function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.txt')) {
    return 'Alege un fișier PDF sau TXT.';
  }
  if (file.size === 0) {
    return 'Fișierul este gol.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'Fișierul depășește 10 MB.';
  }
  return null;
}

function uploadError(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 413) {
    return 'Fișierul depășește 10 MB.';
  }
  return problemDetail(err);
}

/** Încarcă document / Editează documentul (metadate + înlocuirea fișierului). */
@Component({
  selector: 'app-document-form-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, SelectModule, TextareaModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="document() ? 'Editează documentul' : 'Încarcă document'"
              [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (!document()) {
          <div class="field">
            <span class="t-label" id="doc-fisier-et">Fișier</span>
            <div class="drop" [class.over]="over()" role="group" aria-labelledby="doc-fisier-et"
                 (dragover)="onDrag($event, true)" (dragleave)="onDrag($event, false)" (drop)="onDrop($event)">
              @if (file(); as f) {
                <span><strong>{{ f.name }}</strong>, {{ sizeText(f) }}</span>
              } @else {
                <span><strong>Trage fișierul aici</strong> sau alege-l din calculator.</span>
              }
              <input #pick class="hidden-input" type="file" id="doc-fisier" accept=".pdf,.txt" tabindex="-1"
                     aria-hidden="true" (change)="onPick(pick)" />
              <p-button [label]="file() ? 'Alege alt fișier' : 'Alege fișier'" size="small" severity="secondary"
                        [outlined]="true" [disabled]="busy()" ariaLabel="Alege fișier pentru încărcare"
                        (onClick)="pick.click()" />
            </div>
            <p id="doc-fisier-ajutor" class="t-body-sm" [class.err]="!!fileError()" [class.t-muted]="!fileError()">
              {{ fileError() || 'PDF sau TXT, cel mult 10 MB.' }}
            </p>
          </div>
        }
        <div class="field">
          <label class="t-label" for="doc-titlu">Titlu</label>
          <input pInputText id="doc-titlu" formControlName="title" maxlength="150" autocomplete="off"
                 [attr.aria-invalid]="show('title') ? 'true' : null" aria-describedby="doc-titlu-ajutor" />
          <p id="doc-titlu-ajutor" class="t-body-sm" [class.err]="show('title')" [class.t-muted]="!show('title')">
            @if (show('title')) { Introdu titlul (cel mult 150 de caractere). }
            @else if (!document()) { Preluat din numele fișierului. Îl poți modifica. }
            @else { Cel mult 150 de caractere. }
          </p>
        </div>
        <div class="field">
          <label class="t-label" id="doc-categorie-et">Categorie</label>
          <p-select inputId="doc-categorie" formControlName="category" [options]="categoryOptions()" [editable]="true"
                    [fluid]="true" appendTo="body" [maxlength]="50" ariaLabelledBy="doc-categorie-et"
                    aria-describedby="doc-categorie-ajutor" />
          <p id="doc-categorie-ajutor" class="t-body-sm" [class.err]="show('category')" [class.t-muted]="!show('category')">
            @if (show('category')) { Alege sau scrie o categorie (cel mult 50 de caractere). }
            @else { Alege o categorie existentă sau scrie una nouă. }
          </p>
        </div>
        <div class="field">
          <label class="t-label" id="doc-vizibil-et">Vizibil pentru</label>
          <p-select inputId="doc-vizibil" formControlName="visibility" [options]="visibilityOptions" optionLabel="label"
                    optionValue="value" [fluid]="true" appendTo="body" ariaLabelledBy="doc-vizibil-et" />
        </div>
        <div class="field">
          <label class="t-label" for="doc-descriere">Descriere (opțional)</label>
          <textarea pTextarea id="doc-descriere" formControlName="description" rows="3" maxlength="500"
                    aria-describedby="doc-descriere-ajutor"></textarea>
          <p id="doc-descriere-ajutor" class="t-body-sm t-muted">Cel mult 500 de caractere.</p>
        </div>
        <p class="warn t-body-sm">
          Nu încărca documente cu date personale ale angajaților (contracte, salarii, evaluări).
        </p>
        @if (progress() !== null) {
          <div class="prog" role="progressbar" aria-label="Progres încărcare" aria-valuemin="0" aria-valuemax="100"
               [attr.aria-valuenow]="progress()">
            <i [style.width.%]="progress()"></i>
          </div>
        }
        @if (document()) {
          <div class="replace">
            <span class="t-label" id="doc-inloc-et">Înlocuiește fișierul</span>
            <div class="row">
              <input #pickNew class="hidden-input" type="file" accept=".pdf,.txt" tabindex="-1" aria-hidden="true"
                     (change)="onPick(pickNew)" />
              <p-button [label]="file() ? 'Alege alt fișier' : 'Alege fișier'" size="small" severity="secondary"
                        [outlined]="true" [disabled]="busy()" ariaLabel="Alege fișierul care înlocuiește documentul"
                        (onClick)="pickNew.click()" />
              @if (file(); as f) {
                <span class="t-body-sm">{{ f.name }}, {{ sizeText(f) }}</span>
                <p-button label="Înlocuiește fișierul" size="small" severity="secondary" [outlined]="true"
                          [disabled]="busy() || !!fileError()" (onClick)="replace()" />
              }
            </div>
            <p class="t-body-sm" [class.err]="!!fileError()" [class.t-muted]="!fileError()">
              {{ fileError() || (replaced() ? 'Fișierul a fost înlocuit.' : 'PDF sau TXT, cel mult 10 MB.') }}
            </p>
          </div>
        }
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="document() ? 'Salvează' : 'Încarcă'" [loading]="busy()" [disabled]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class DocumentFormDialog implements OnInit {
  private readonly api = inject(DocumentsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly document = input<LibraryDocument | null>(null);
  readonly categories = input<CategoryCount[]>([]);
  readonly closed = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal('');
  protected readonly over = signal(false);
  protected readonly progress = signal<number | null>(null);
  protected readonly replaced = signal(false);
  private changed = false;

  protected readonly visibilityOptions = (Object.keys(VISIBILITY_LABELS) as DocumentVisibility[]).map((v) => ({
    label: VISIBILITY_LABELS[v],
    value: v,
  }));
  protected readonly categoryOptions = computed(() => this.categories().map((c) => c.category));

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(150)] }),
    category: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(50)] }),
    visibility: new FormControl<DocumentVisibility>('ALL', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  ngOnInit(): void {
    const d = this.document();
    if (d) {
      this.form.setValue({
        title: d.title, category: d.category, visibility: d.visibility, description: d.description ?? '',
      });
    }
  }

  protected show(name: 'title' | 'category'): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected sizeText(f: File): string {
    return formatSize(f.size);
  }

  protected onDrag(e: DragEvent, over: boolean): void {
    e.preventDefault();
    this.over.set(over);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.over.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && !this.busy()) {
      this.setFile(f);
    }
  }

  protected onPick(input: HTMLInputElement): void {
    const f = input.files?.[0];
    input.value = '';
    if (f) {
      this.setFile(f);
    }
  }

  private setFile(f: File): void {
    this.replaced.set(false);
    this.error.set('');
    const problem = validateFile(f);
    this.fileError.set(problem ?? '');
    this.file.set(problem ? null : f);
    if (!problem && !this.document() && !this.form.controls.title.value.trim()) {
      this.form.controls.title.setValue(f.name.replace(/\.[^.]+$/, '').slice(0, 150));
    }
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(this.changed);
    }
  }

  private meta() {
    const v = this.form.getRawValue();
    return {
      title: v.title.trim(),
      description: v.description.trim() || null,
      category: v.category.trim(),
      visibility: v.visibility,
    };
  }

  private run(call: Observable<UploadEvent>, done: (doc: LibraryDocument) => void): void {
    this.busy.set(true);
    this.error.set('');
    this.progress.set(0);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (e) => {
        if ('progress' in e) {
          this.progress.set(e.progress);
        } else {
          this.busy.set(false);
          this.progress.set(null);
          done(e.document);
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.progress.set(null);
        this.error.set(uploadError(err));
      },
    });
  }

  protected replace(): void {
    const d = this.document();
    const f = this.file();
    if (!d || !f || this.busy()) {
      return;
    }
    this.run(this.api.replaceFile(d.id, f), () => {
      this.changed = true;
      this.replaced.set(true);
      this.file.set(null);
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    const d = this.document();
    if (!d && !this.file()) {
      this.fileError.set(this.fileError() || 'Alege un fișier PDF sau TXT.');
    }
    if (this.form.invalid || (!d && !this.file()) || this.busy()) {
      return;
    }
    if (d) {
      this.busy.set(true);
      this.error.set('');
      this.api.update(d.id, this.meta()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
      return;
    }
    this.run(this.api.upload(this.file()!, this.meta()), () => this.closed.emit(true));
  }
}

/** Confirmare pentru ștergerea unui document. */
@Component({
  selector: 'app-document-delete-dialog',
  imports: [ButtonModule, DialogModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Șterge documentul"
              [style]="{ width: '32rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        <p>Documentul <strong>{{ document().title }}</strong> va fi șters definitiv. Acțiunea nu poate fi anulată.</p>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Șterge documentul" severity="danger" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class DocumentDeleteDialog {
  private readonly api = inject(DocumentsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly document = input.required<LibraryDocument>();
  readonly closed = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(false);
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.remove(this.document().id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.closed.emit(true);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(problemDetail(err));
      },
    });
  }
}
