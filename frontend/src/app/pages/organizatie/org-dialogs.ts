import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { problemDetail } from '../../core/leave/leave.service';
import { Department, OrgService, Position, flattenDepartments } from '../../core/org/org.service';

const STYLES = `
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: var(--space-1); }
  .err { color: var(--danger-ink); }
`;

function notBlank(c: AbstractControl<string>): ValidationErrors | null {
  return c.value.trim() ? null : { required: true };
}

/** Departament nou / Editează departamentul. */
@Component({
  selector: 'app-department-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="department() ? 'Editează departamentul' : 'Departament nou'"
              [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="t-label" for="dep-nume">Nume</label>
          <input pInputText id="dep-nume" formControlName="name" maxlength="150" autocomplete="off"
                 [attr.aria-invalid]="showName() ? 'true' : null" aria-describedby="dep-nume-err" />
          <p id="dep-nume-err" class="t-body-sm err">
            @if (showName()) { Introdu numele departamentului (cel mult 150 de caractere). }
          </p>
        </div>
        <div class="field">
          <label class="t-label" id="dep-parinte-et">Departament părinte (opțional)</label>
          <p-select inputId="dep-parinte" formControlName="parentId" [options]="parentOptions()"
                    optionLabel="label" optionValue="value" [fluid]="true" appendTo="body"
                    ariaLabelledBy="dep-parinte-et" aria-describedby="dep-parinte-ajutor" />
          <p id="dep-parinte-ajutor" class="t-body-sm t-muted">Ierarhia poate avea cel mult 10 niveluri.</p>
        </div>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="department() ? 'Salvează' : 'Adaugă departamentul'" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class DepartmentDialog implements OnInit {
  private readonly api = inject(OrgService);
  private readonly destroyRef = inject(DestroyRef);

  readonly department = input<Department | null>(null);
  readonly departments = input.required<Department[]>();
  readonly closed = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(150)] }),
    parentId: new FormControl<string | null>(null),
  });

  protected readonly parentOptions = computed(() => {
    const self = this.department();
    const excluded = new Set<string>();
    if (self) {
      excluded.add(self.id);
      // descendenții: o trecere repetată peste listă
      let grew = true;
      while (grew) {
        grew = false;
        for (const d of this.departments()) {
          if (d.parentId && excluded.has(d.parentId) && !excluded.has(d.id)) {
            excluded.add(d.id);
            grew = true;
          }
        }
      }
    }
    return [
      { label: 'Fără părinte (nivel superior)', value: null as string | null },
      ...flattenDepartments(this.departments())
        .filter((n) => !excluded.has(n.department.id))
        .map((n) => ({ label: n.path, value: n.department.id as string | null })),
    ];
  });

  ngOnInit(): void {
    const d = this.department();
    if (d) {
      this.form.setValue({ name: d.name, parentId: d.parentId });
    }
  }

  protected showName(): boolean {
    return this.submitted() && this.form.controls.name.invalid;
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(false);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), parentId: v.parentId };
    const d = this.department();
    this.busy.set(true);
    this.error.set('');
    (d ? this.api.updateDepartment(d.id, body) : this.api.createDepartment(body))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

/** Post nou / Editează postul. */
@Component({
  selector: 'app-position-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="position() ? 'Editează postul' : 'Post nou'"
              [style]="{ width: '30rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="t-label" for="post-nume">Nume</label>
          <input pInputText id="post-nume" formControlName="name" maxlength="150" autocomplete="off"
                 [attr.aria-invalid]="show() ? 'true' : null" aria-describedby="post-nume-err" />
          <p id="post-nume-err" class="t-body-sm err">
            @if (show()) { Introdu numele postului (cel mult 150 de caractere). }
          </p>
        </div>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="position() ? 'Salvează' : 'Adaugă postul'" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class PositionDialog implements OnInit {
  private readonly api = inject(OrgService);
  private readonly destroyRef = inject(DestroyRef);

  readonly position = input<Position | null>(null);
  readonly closed = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(150)] }),
  });

  ngOnInit(): void {
    const p = this.position();
    if (p) {
      this.form.setValue({ name: p.name });
    }
  }

  protected show(): boolean {
    return this.submitted() && this.form.controls.name.invalid;
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(false);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const body = { name: this.form.getRawValue().name.trim() };
    const p = this.position();
    this.busy.set(true);
    this.error.set('');
    (p ? this.api.updatePosition(p.id, body) : this.api.createPosition(body))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

/** Confirmare pentru ștergerea unui departament sau a unui post. */
@Component({
  selector: 'app-org-delete-dialog',
  imports: [ButtonModule, DialogModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="kind() === 'department' ? 'Șterge departamentul' : 'Șterge postul'"
              [style]="{ width: '32rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        <p>
          {{ kind() === 'department' ? 'Departamentul' : 'Postul' }} <strong>{{ name() }}</strong>
          va fi șters definitiv. Acțiunea nu poate fi anulată.
        </p>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="kind() === 'department' ? 'Șterge departamentul' : 'Șterge postul'" severity="danger"
                  [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class OrgDeleteDialog {
  private readonly api = inject(OrgService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kind = input.required<'department' | 'position'>();
  readonly itemId = input.required<string>();
  readonly name = input.required<string>();
  readonly closed = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private dirty = false;

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(this.dirty);
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    (this.kind() === 'department' ? this.api.deleteDepartment(this.itemId()) : this.api.deletePosition(this.itemId()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.dirty = true;
          this.error.set(problemDetail(err));
        },
      });
  }
}
