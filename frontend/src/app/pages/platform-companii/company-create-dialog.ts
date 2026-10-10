import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PlatformService } from '../../core/platform/platform.service';
import { problemDetail } from '../../core/leave/leave.service';
import { PasswordInput, passwordValidator } from '../../shared/password-input/password-input';

/** Companie nouă, cu primul administrator. Parola nu se mai afișează după salvare. */
@Component({
  selector: 'app-company-create-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, PasswordInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Companie nouă"
              [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="t-label" for="c-nume">Nume</label>
          <input pInputText id="c-nume" formControlName="name" autocomplete="off" maxlength="200"
                 [attr.aria-invalid]="bad('name') ? 'true' : null" aria-describedby="c-nume-ajutor" />
          <p id="c-nume-ajutor" class="t-body-sm" [class.err]="bad('name')" [class.t-muted]="!bad('name')">
            {{ bad('name') ? 'Introdu numele companiei.' : 'Numele afișat al companiei.' }}
          </p>
        </div>

        <div class="field">
          <label class="t-label" for="c-cod">Cod</label>
          <input pInputText id="c-cod" formControlName="code" autocomplete="off" autocapitalize="off"
                 spellcheck="false" maxlength="32"
                 [attr.aria-invalid]="bad('code') ? 'true' : null" aria-describedby="c-cod-ajutor" />
          <p id="c-cod-ajutor" class="t-body-sm" [class.err]="bad('code')" [class.t-muted]="!bad('code')">
            @if (bad('code')) {
              Codul are 3 până la 32 de caractere: litere mici, cifre sau cratimă.
            } @else {
              Folosit la autentificare. Litere mici, cifre și cratimă, 3 până la 32 de caractere.
            }
          </p>
        </div>

        <div class="field">
          <label class="t-label" for="c-email">E-mail administrator</label>
          <input pInputText id="c-email" type="email" formControlName="adminEmail" autocomplete="off"
                 maxlength="254" [attr.aria-invalid]="bad('adminEmail') ? 'true' : null"
                 aria-describedby="c-email-ajutor" />
          <p id="c-email-ajutor" class="t-body-sm" [class.err]="bad('adminEmail')" [class.t-muted]="!bad('adminEmail')">
            {{ bad('adminEmail') ? 'Introdu o adresă de e-mail validă.' : 'Primul cont de administrator al companiei.' }}
          </p>
        </div>

        <div class="field">
          <label class="t-label" for="c-parola">Parolă administrator</label>
          <app-password-input inputId="c-parola" formControlName="adminPassword"
                              [invalid]="bad('adminPassword')" describedBy="c-parola-ajutor" />
          <p id="c-parola-ajutor" class="t-body-sm" [class.err]="bad('adminPassword')" [class.t-muted]="!bad('adminPassword')">
            @if (submitted() && form.controls.adminPassword.hasError('maxbytes')) {
              Parola poate avea cel mult 72 de octeți.
            } @else if (bad('adminPassword')) {
              Parola trebuie să aibă cel puțin 12 caractere.
            } @else {
              Cel puțin 12 caractere. Comunic-o pe un canal sigur; nu va mai fi afișată după salvare.
            }
          </p>
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Creează compania" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form { display: grid; gap: var(--space-4); }
    .field { display: grid; gap: var(--space-1); }
    .err { color: var(--danger-ink); }
  `,
})
export class CompanyCreateDialog {
  private readonly platform = inject(PlatformService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<boolean>();

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-z0-9-]{3,32}$/)] }),
    adminEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    adminPassword: new FormControl('', { nonNullable: true, validators: [passwordValidator] }),
  });
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  private dirty = false;

  protected bad(name: keyof typeof this.form.controls): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected close(): void {
    if (!this.busy()) {
      this.form.controls.adminPassword.reset('');
      this.closed.emit(this.dirty);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.platform
      .createCompany({ name: v.name.trim(), code: v.code, adminEmail: v.adminEmail.trim(), adminPassword: v.adminPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.form.controls.adminPassword.reset('');
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
