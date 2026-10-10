import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LogoMark } from './logo-mark';

@Component({
  selector: 'app-logo',
  imports: [LogoMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-logo-mark [size]="markSize()" [decorative]="true" />
    <span class="word" [style.font-size.px]="markSize() * 0.625">Smart HR</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 96px;
      color: var(--ink);
    }
    .word {
      font-family: Inter, var(--font-sans);
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1;
      white-space: nowrap;
    }
  `,
})
export class Logo {
  /** Latura semnului în pixeli; textul se scalează proporțional. */
  readonly markSize = input(32);
}
