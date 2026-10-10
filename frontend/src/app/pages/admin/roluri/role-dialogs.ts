import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, concat, last, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AdminRole, AdminService, PermissionInfo } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { problemDetail } from '../../../core/leave/leave.service';

const STYLES = `
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: var(--space-1); }
  .err { color: var(--danger-ink); }
  .perms { list-style: none; margin: 0; padding: var(--space-3) var(--space-4); display: grid; gap: var(--space-2);
           max-height: 18rem; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-field); }
  .perm { display: flex; gap: var(--space-3); align-items: flex-start; min-height: 36px; padding: var(--space-1) 0; }
  .perm .text { display: grid; }
  .perm label { cursor: pointer; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 16px; }
`;

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Rol nou sau editare (nume și privilegii). Privilegiile pe care apelantul nu le deține sunt dezactivate. */
@Component({
  selector: 'app-role-dialog',
  imports: [ReactiveFormsModule, FormsModule, ButtonModule, CheckboxModule, DialogModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="role() ? 'Editează rolul' : 'Rol nou'"
              [style]="{ width: '38rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" (submit)="$event.preventDefault(); submit()" novalidate>
        <div class="field">
          <label class="t-label" for="rol-nume">Nume</label>
          <input pInputText id="rol-nume" [formControl]="name" maxlength="100" autocomplete="off"
                 [attr.aria-invalid]="submitted() && name.invalid ? 'true' : null" aria-describedby="rol-nume-ajutor" />
          <p id="rol-nume-ajutor" class="t-body-sm" [class.err]="submitted() && name.invalid"
             [class.t-muted]="!(submitted() && name.invalid)">
            @if (submitted() && name.invalid) {
              Numele este obligatoriu.
            } @else {
              Cel mult 100 de caractere.
            }
          </p>
        </div>

        <div class="field">
          <span class="t-label" id="rol-privilegii">Privilegii</span>
          <ul class="perms" role="group" aria-labelledby="rol-privilegii">
            @for (p of catalog(); track p.code) {
              <li class="perm">
                <p-checkbox [inputId]="'priv-' + p.code" [binary]="true" [disabled]="!canGrant(p.code)"
                            [ngModel]="selected().has(p.code)" (ngModelChange)="toggle(p.code, $event)"
                            [ngModelOptions]="{ standalone: true }" />
                <div class="text">
                  <label [for]="'priv-' + p.code">{{ p.description }}</label>
                  <span class="code t-muted">{{ p.code }}</span>
                  @if (!canGrant(p.code)) {
                    <span class="t-body-sm t-muted">Nu poți acorda acest privilegiu, pentru că nu îl deții.</span>
                  }
                </div>
              </li>
            }
          </ul>
          <p class="t-body-sm t-muted">Poți acorda doar privilegiile pe care le deții tu.</p>
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="role() ? 'Salvează' : 'Creează rolul'" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class RoleDialog implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly role = input<AdminRole | null>(null);
  readonly catalog = input.required<PermissionInfo[]>();
  readonly closed = output<boolean>();

  protected readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] });
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  private dirty = false;

  ngOnInit(): void {
    const r = this.role();
    if (r) {
      this.name.setValue(r.name);
      this.selected.set(new Set(r.permissions));
    }
  }

  protected canGrant(code: string): boolean {
    return this.auth.hasPermission(code);
  }

  protected toggle(code: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    this.selected.set(next);
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(this.dirty);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    const name = this.name.value.trim();
    if (!name || this.name.invalid || this.busy()) {
      return;
    }
    const permissions = [...this.selected()];
    const r = this.role();
    let calls: Observable<unknown>;
    if (!r) {
      calls = this.admin.createRole(name, permissions);
    } else {
      const steps: Observable<unknown>[] = [];
      if (name !== r.name) {
        steps.push(this.admin.renameRole(r.id, name));
      }
      if (!sameSet(permissions, r.permissions)) {
        steps.push(this.admin.setRolePermissions(r.id, permissions));
      }
      calls = steps.length ? concat(...steps).pipe(last()) : of(null);
    }
    this.busy.set(true);
    this.error.set('');
    calls.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

/** Confirmare pentru ștergerea unui rol (permisă doar pentru roluri neatribuite). */
@Component({
  selector: 'app-role-delete-dialog',
  imports: [ButtonModule, DialogModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Șterge rolul"
              [style]="{ width: '32rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        <p>Rolul <strong>{{ role().name }}</strong> va fi șters definitiv. Acțiunea nu poate fi anulată.</p>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Șterge rolul" severity="danger" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: STYLES,
})
export class RoleDeleteDialog {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly role = input.required<AdminRole>();
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
    this.admin
      .deleteRole(this.role().id)
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
