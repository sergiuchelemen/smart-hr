import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';

@Component({
  selector: 'app-acasa',
  imports: [RouterLink, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1 class="t-title">Bun venit{{ company() ? ', ' + company() : '' }}</h1>
      <p class="t-muted">Alege o secțiune pentru a începe.</p>
    </header>
    <ul class="shortcuts">
      <li *appHasPermission="'EMPLOYEE_READ'">
        <a routerLink="/angajati" class="card panel">
          <span class="t-heading">Angajați</span>
          <span class="t-body-sm t-muted">Vezi lista angajaților companiei.</span>
        </a>
      </li>
    </ul>
    @if (!auth.permissions().length) {
      <p class="panel empty t-muted">Contul tău nu are încă nicio secțiune disponibilă. Cere acces administratorului companiei.</p>
    }
  `,
  styles: `
    .head { display: grid; gap: var(--space-1); margin-bottom: var(--space-5); }
    .shortcuts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-4); }
    .card { display: grid; gap: var(--space-1); padding: var(--space-5); color: var(--ink); text-decoration: none; transition: border-color var(--motion), background-color var(--motion); }
    .card:hover { border-color: var(--brand); background: var(--brand-tint); }
    .empty { padding: var(--space-5); }
  `,
})
export class AcasaPage {
  protected readonly auth = inject(AuthService);
  protected readonly company = computed(() => this.auth.user()?.company.name ?? '');
}
