import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('ro-RO', { month: 'short' }).format(new Date(2026, i, 1)).replace('.', '').slice(0, 3),
);

/** 12 bare lunare; luna evidențiată folosește accentul, valorile sunt text sub bară. */
@Component({
  selector: 'app-month-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="bars" role="img" [attr.aria-label]="description()">
      @for (c of cols(); track c.month) {
        <li class="col" [class.cur]="c.current" [title]="c.name + ': ' + c.days + ' zile'">
          <span class="track"><span class="bar" [style.height.%]="c.pct" [style.animation-delay.ms]="c.month * 25"></span></span>
          <span class="val t-label num">{{ c.days }}</span>
          <span class="mon t-label">{{ c.short }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .bars { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--space-1); }
    .col { display: grid; justify-items: center; gap: 2px; min-width: 0; }
    .track { display: flex; align-items: flex-end; width: 100%; height: 96px; }
    .bar { display: block; width: 100%; min-height: 3px; border-radius: 6px 6px 2px 2px; background: var(--border-strong); opacity: 0.55; transform-origin: bottom; animation: rise 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
    .cur .bar { background: var(--brand); opacity: 1; }
    .val { color: var(--ink-muted); font-weight: 500; font-size: 11px; }
    .mon { color: var(--ink-muted); font-weight: 500; font-size: 11px; }
    .cur .val, .cur .mon { color: var(--brand-ink); font-weight: 700; }
    @keyframes rise { from { transform: scaleY(0); } }
  `,
})
export class MonthBars {
  readonly data = input.required<{ month: number; days: number }[]>();
  readonly currentMonth = input.required<number>();
  readonly description = input.required<string>();

  protected readonly cols = computed(() => {
    const byMonth = new Map(this.data().map((d) => [d.month, d.days]));
    const max = Math.max(1, ...this.data().map((d) => d.days));
    return MONTHS.map((short, i) => {
      const days = byMonth.get(i + 1) ?? 0;
      return {
        month: i + 1,
        short,
        name: new Intl.DateTimeFormat('ro-RO', { month: 'long' }).format(new Date(2026, i, 1)),
        days,
        pct: (days / max) * 100,
        current: i + 1 === this.currentMonth(),
      };
    });
  });
}
