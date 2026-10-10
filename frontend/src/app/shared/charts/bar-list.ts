import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarItem {
  label: string;
  value: number;
}

/** Bare orizontale cu etichetă și valoare ca text. */
@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list">
      @for (it of items(); track it.label; let i = $index) {
        <li class="row">
          <span class="label t-body-sm" [title]="it.label">{{ it.label }}</span>
          <span class="bar" aria-hidden="true">
            <span class="fill" [style.width.%]="pct(it.value)" [style.animation-delay.ms]="i * 40"></span>
          </span>
          <span class="value t-body-sm num">{{ it.value }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
    .row { display: grid; grid-template-columns: minmax(6rem, 38%) 1fr 2.5rem; align-items: center; gap: var(--space-3); }
    .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar { height: 8px; border-radius: var(--radius-pill); background: var(--surface-sunken); overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: var(--radius-pill); background: var(--brand); transform-origin: left; animation: grow 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
    .value { text-align: right; font-weight: 600; }
    @keyframes grow { from { transform: scaleX(0); } }
  `,
})
export class BarList {
  readonly items = input.required<BarItem[]>();
  private readonly max = computed(() => Math.max(1, ...this.items().map((i) => i.value)));
  protected pct(v: number): number {
    return (v / this.max()) * 100;
  }
}
