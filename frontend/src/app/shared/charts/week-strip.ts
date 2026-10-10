import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface WeekAbsence {
  name: string;
  from: string;
  to: string;
}

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MAX_ROWS = 8;
const short = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Săptămâna luni-duminică, un rând pe persoană, cu bară pe zilele de concediu. */
@Component({
  selector: 'app-week-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip" role="img" [attr.aria-label]="description()">
      <div class="head">
        <span></span>
        <span class="days">
          @for (d of header(); track $index) {
            <span class="d t-label" [class.today]="d.today">{{ d.letter }}</span>
          }
        </span>
      </div>
      @for (r of rows(); track $index) {
        <div class="row">
          <span class="who">
            <span class="name t-body-sm">{{ r.name }}</span>
            <span class="range t-label t-muted num">{{ r.range }}</span>
          </span>
          <span class="days grid">
            <span class="span" [style.grid-column]="r.start + ' / ' + (r.end + 1)" [style.animation-delay.ms]="$index * 40"></span>
          </span>
        </div>
      }
      @if (extra() > 0) {
        <p class="more t-body-sm t-muted">+{{ extra() }} {{ extra() === 1 ? 'persoană' : 'persoane' }}</p>
      }
    </div>
  `,
  styles: `
    .strip { display: grid; gap: var(--space-3); }
    .head, .row { display: grid; grid-template-columns: minmax(7rem, 40%) 1fr; gap: var(--space-3); align-items: center; }
    .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .d { text-align: center; color: var(--ink-muted); border-radius: var(--radius-pill); padding: 2px 0; }
    .d.today { background: var(--brand-tint); color: var(--brand-ink); }
    .who { display: grid; min-width: 0; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .range { font-weight: 500; }
    .grid { background: var(--surface-sunken); border-radius: var(--radius-pill); height: 14px; overflow: hidden; }
    .span { background: var(--brand); border-radius: var(--radius-pill); transform-origin: left; animation: grow 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
    .more { margin: 0; }
    @keyframes grow { from { transform: scaleX(0); } }
  `,
})
export class WeekStrip {
  readonly items = input.required<WeekAbsence[]>();
  readonly today = input.required<Date>();
  readonly description = input.required<string>();

  private readonly monday = computed(() => {
    const t = this.today();
    const m = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  });

  protected readonly header = computed(() => {
    const idx = (this.today().getDay() + 6) % 7;
    return DAYS.map((letter, i) => ({ letter, today: i === idx }));
  });

  private readonly all = computed(() =>
    this.items()
      .map((it) => {
        const from = parse(it.from);
        const to = parse(it.to);
        const s = Math.max(dayDiff(from, this.monday()), 0);
        const e = Math.min(dayDiff(to, this.monday()), 6);
        const range = it.from === it.to ? short.format(from) : `${short.format(from)} - ${short.format(to)}`;
        return { name: it.name, range, start: s + 1, end: e + 1, ok: e >= s };
      })
      .filter((r) => r.ok),
  );
  protected readonly rows = computed(() => this.all().slice(0, MAX_ROWS));
  protected readonly extra = computed(() => Math.max(this.all().length - MAX_ROWS, 0));
}
