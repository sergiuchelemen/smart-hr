import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PlatformAuthService } from '../../core/platform-auth/platform-auth.service';
import { Logo } from '../../shared/logo/logo';

@Component({
  selector: 'app-platform-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <form class="panel form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <header>
          <h1 class="brand"><app-logo [markSize]="48" /></h1>
          <p class="t-muted">Autentificare pentru administrarea platformei.</p>
        </header>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }

        <div class="field">
          <label for="email" class="t-label">E-mail</label>
          <input pInputText id="email" type="email" formControlName="email" autocomplete="username"
                 [attr.aria-invalid]="invalid('email')" aria-describedby="email-msg" fluid />
          <small id="email-msg" [class.err]="invalid('email')">
            {{ invalid('email') ? 'Introdu o adresă de e-mail validă.' : '' }}
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
        <a routerLink="/login" class="t-body-sm back">Înapoi la autentificarea companiei</a>
      </form>
    </main>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: var(--space-4); }
    .form { width: 100%; max-width: 420px; padding: var(--space-6); display: grid; gap: var(--space-4); }
    header { display: grid; gap: var(--space-3); }
    .brand { margin: 0; padding: var(--space-3) 0; }
    .field { display: grid; gap: var(--space-1); }
    small { min-height: 20px; font-size: 13px; line-height: 20px; color: var(--ink-muted); }
    small.err { color: var(--danger-ink); }
    .back { justify-self: center; color: var(--ink-muted); }
    .back:hover { color: var(--brand-ink); }
    .back:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: var(--radius-field); }
  `,
})
export class PlatformLoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(PlatformAuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected invalid(name: 'email' | 'password'): boolean {
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
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/platform/companii');
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
