import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PlatformAuthService } from '../../core/platform-auth/platform-auth.service';
import { ThemeChoice, ThemeService } from '../../core/theme/theme.service';
import { Logo } from '../../shared/logo/logo';

@Component({
  selector: 'app-platform-shell',
  imports: [RouterOutlet, RouterLink, FormsModule, ButtonModule, SelectModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <a routerLink="/platform/companii" class="brand" aria-label="Smart HR, administrare platformă">
        <app-logo [markSize]="28" />
      </a>
      <span class="title t-heading">Administrare platformă</span>
      <div class="spacer"></div>
      <p-select [options]="themes" optionLabel="label" optionValue="value" [ngModel]="theme.choice()"
                (ngModelChange)="setTheme($event)" ariaLabel="Temă de culori" />
      <p-button label="Deconectare" icon="pi pi-sign-out" severity="secondary" [outlined]="true"
                (onClick)="auth.logout()" />
    </header>
    <main class="content">
      <router-outlet />
    </main>
  `,
  styles: `
    .topbar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      background: var(--surface-raised);
      border-bottom: 1px solid var(--border);
      min-height: 64px;
    }
    .brand { display: inline-flex; border-radius: var(--radius-field); margin-right: var(--space-4); text-decoration: none; }
    .brand:focus-visible { outline: 2px solid var(--brand); outline-offset: 4px; }
    .spacer { flex: 1; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .content { padding: var(--space-5); max-width: 72rem; margin: 0 auto; min-width: 0; }
    @media (max-width: 900px) {
      .topbar { padding: var(--space-2) var(--space-3); }
      .content { padding: var(--space-4); }
    }
  `,
})
export class PlatformShell {
  protected readonly auth = inject(PlatformAuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly themes: { label: string; value: ThemeChoice }[] = [
    { label: 'Luminos', value: 'light' },
    { label: 'Întunecat', value: 'dark' },
  ];

  protected setTheme(value: ThemeChoice): void {
    this.theme.set(value);
  }
}
