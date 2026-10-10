import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <form class="panel form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <header>
          <h1 class="t-title">Smart HR</h1>
          <p class="t-muted">Autentifică-te în contul companiei tale.</p>
        </header>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }

        <div class="field">
          <label for="companyCode" class="t-label">Cod companie</label>
          <input pInputText id="companyCode" formControlName="companyCode" autocomplete="organization"
                 autocapitalize="off" spellcheck="false" [attr.aria-invalid]="invalid('companyCode')"
                 aria-describedby="companyCode-msg" fluid />
          <small id="companyCode-msg" [class.err]="invalid('companyCode')">
            {{ invalid('companyCode') ? 'Introdu codul companiei.' : 'Codul primit de la administrator.' }}
          </small>
        </div>

        <div class="field">
          <label for="email" class="t-label">Email</label>
          <input pInputText id="email" type="email" formControlName="email" autocomplete="username"
                 [attr.aria-invalid]="invalid('email')" aria-describedby="email-msg" fluid />
          <small id="email-msg" [class.err]="invalid('email')">
            {{ invalid('email') ? 'Introdu o adresă de email validă.' : 'Adresa folosită pentru cont.' }}
          </small>
        </div>

        <div class="field">
          <label for="password" class="t-label">Parolă</label>
          <input pInputText id="password" type="password" formControlName="password"
                 autocomplete="current-password" [attr.aria-invalid]="invalid('password')"
                 aria-describedby="password-msg" fluid />
          <small id="password-msg" [class.err]="invalid('password')">
            {{ invalid('password') ? 'Introdu parola.' : '' }}
          </small>
        </div>

        <p-button type="submit" label="Autentificare" [loading]="loading()" [fluid]="true" />
      </form>
    </main>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: var(--space-4); }
    .form { width: 100%; max-width: 420px; padding: var(--space-6); display: grid; gap: var(--space-4); }
    header { display: grid; gap: var(--space-1); }
    .field { display: grid; gap: var(--space-1); }
    small { min-height: 20px; font-size: 13px; line-height: 20px; color: var(--ink-muted); }
    small.err { color: var(--danger-ink); }
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    companyCode: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected invalid(name: 'companyCode' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const { companyCode, email, password } = this.form.getRawValue();
    this.auth.login({ companyCode: companyCode.trim(), email: email.trim(), password }).subscribe({
      next: async () => {
        await this.auth.loadUser();
        this.loading.set(false);
        await this.router.navigateByUrl('/acasa');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const unavailable = err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500);
        this.error.set(
          unavailable
            ? 'Serviciul nu este disponibil momentan. Încearcă din nou.'
            : 'Date de autentificare incorecte.',
        );
      },
    });
  }
}
