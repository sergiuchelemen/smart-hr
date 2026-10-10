import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PlatformService } from '../../core/platform/platform.service';
import { problemDetail } from '../../core/leave/leave.service';
import { PasswordInput, passwordValidator } from '../../shared/password-input/password-input';

@Component({
  selector: 'app-admin-add-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, PasswordInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Adaugă administrator"
              [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="t-label" for="a-email">E-mail</label>
          <input pInputText id="a-email" type="email" formControlName="email" autocomplete="off" maxlength="254"
                 [attr.aria-invalid]="bad('email') ? 'true' : null" aria-describedby="a-email-ajutor" />
          <p id="a-email-ajutor" class="t-body-sm" [class.err]="bad('email')" [class.t-muted]="!bad('email')">
            {{ bad('email') ? 'Introdu o adresă de e-mail validă.' : 'Contul primește toate privilegiile companiei.' }}
          </p>
        </div>

        <div class="field">
          <label class="t-label" for="a-parola">Parolă</label>
          <app-password-input inputId="a-parola" formControlName="password"
                              [invalid]="bad('password')" describedBy="a-parola-ajutor" />
          <p id="a-parola-ajutor" class="t-body-sm" [class.err]="bad('password')" [class.t-muted]="!bad('password')">
            @if (submitted() && form.controls.password.hasError('maxbytes')) {
              Parola poate avea cel mult 72 de octeți.
            } @else if (bad('password')) {
              Parola trebuie să aibă cel puțin 12 caractere.
            } @else {
              Cel puțin 12 caractere. Comunică-o pe un canal sigur; nu va mai fi afișată după salvare.
            }
          </p>
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Adaugă administratorul" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form { display: grid; gap: var(--space-4); }
    .field { display: grid; gap: var(--space-1); }
    .err { color: var(--danger-ink); }
  `,
})
export class AdminAddDialog {
  private readonly platform = inject(PlatformService);
  private readonly destroyRef = inject(DestroyRef);

  readonly companyId = input.required<string>();
  readonly closed = output<boolean>();

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [passwordValidator] }),
  });
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');

  protected bad(name: 'email' | 'password'): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected close(): void {
    if (!this.busy()) {
      this.form.controls.password.reset('');
      this.closed.emit(false);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.platform
      .addAdmin(this.companyId(), { email: email.trim(), password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.form.controls.password.reset('');
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(
            err instanceof HttpErrorResponse && err.status === 409
              ? 'Există deja un utilizator cu acest e-mail în companie.'
              : problemDetail(err),
          );
        },
      });
  }
}
