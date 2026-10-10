import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-negasit',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="state">
      <p class="t-label t-muted">Eroare 404</p>
      <h1 class="t-title">Pagina nu a fost găsită</h1>
      <p class="t-muted">Adresa nu există sau a fost mutată.</p>
      <a routerLink="/acasa" class="link">Înapoi la pagina de start</a>
    </main>
  `,
  styles: `
    .state { max-width: 480px; margin: 0 auto; padding: var(--space-7) var(--space-4); display: grid; gap: var(--space-3); }
    .link { display: inline-flex; align-items: center; min-height: 36px; }
  `,
})
export class NegasitPage {}
