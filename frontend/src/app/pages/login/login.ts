import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Logo } from '../../shared/logo/logo';
import { AuthService } from '../../core/auth/auth.service';

const LAST_COMPANY_KEY = 'smarthr.lastCompany';

function readLastCompany(): string {
  try {
    return localStorage.getItem(LAST_COMPANY_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveLastCompany(code: string): void {
  try {
    localStorage.setItem(LAST_COMPANY_KEY, code);
  } catch {
    // ignorat
  }
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <form class="panel form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <header>
          <h1 class="brand"><app-logo [markSize]="48" /></h1>
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
        <a routerLink="/platform/login" class="t-body-sm platform-link">Administrare platformă</a>
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
    .platform-link { justify-self: center; color: var(--ink-muted); }
    .platform-link:hover { color: var(--brand-ink); }
    .platform-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: var(--radius-field); }
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
    companyCode: [readLastCompany(), [Validators.required]],
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
        saveLastCompany(companyCode.trim());
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
