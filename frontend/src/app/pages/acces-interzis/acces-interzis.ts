import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-acces-interzis',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="state panel">
      <h1 class="t-title">Acces interzis</h1>
      <p class="t-muted">Nu ai privilegiile necesare pentru această pagină. Cere acces administratorului companiei.</p>
      <a routerLink="/acasa" class="link">Înapoi la pagina de start</a>
    </section>
  `,
  styles: `
    .state { max-width: 560px; padding: var(--space-6); display: grid; gap: var(--space-3); }
    .link { display: inline-flex; align-items: center; min-height: 36px; }
  `,
})
export class AccesInterzisPage {}
