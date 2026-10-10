import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  BLOCKED_LABELS,
  ENTRY_TYPE_LABELS,
  TimesheetDay,
  formatMinutes,
} from '../../core/timesheet/timesheet.service';
import { formatDate, toIsoDate } from '../format/date';

/** Fereastra de editare din backend: ultimele 35 de zile, până azi inclusiv. */
export const EDIT_WINDOW_DAYS = 35;

const WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

interface Cell {
  date: string;
  day: number;
  editable: boolean;
  weekend: boolean;
  hours: string;
  kind: string;
  blocked: string;
  label: string;
}

/** Cel puțin o dată în fereastra de editare, fără weekend, fără zile blocate. */
export function isEditableDate(date: Date, today: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) {
    return false;
  }
  const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() - EDIT_WINDOW_DAYS);
  const max = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date >= min && date <= max;
}

@Component({
  selector: 'app-timesheet-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal" role="group" [attr.aria-label]="'Calendar de pontaj, ' + monthLabel()">
      <div class="head" aria-hidden="true">
        @for (w of weekdays; track w) {
          <div class="wd t-label t-muted">{{ w }}</div>
        }
      </div>
      <div class="grid">
        @for (i of lead(); track i) {
          <div class="cell empty" aria-hidden="true"></div>
        }
        @for (c of cells(); track c.date) {
          @if (c.editable && editable()) {
            <button type="button" class="cell edit" [attr.aria-label]="c.label"
                    (click)="dayClick.emit(c.date)">
              <span class="d num">{{ c.day }}</span>
              @if (c.hours) {
                <span class="h num">{{ c.hours }}</span>
                @if (c.kind) { <span class="k t-body-sm">{{ c.kind }}</span> }
              } @else {
                <span class="k t-body-sm t-muted">Completează</span>
              }
            </button>
          } @else {
            <div class="cell" [class.weekend]="c.weekend" [class.blocked]="c.blocked">
              <span class="d num">{{ c.day }}</span>
              @if (c.blocked) {
                <span class="k t-body-sm blocked-label">{{ c.blocked }}</span>
              } @else if (c.hours) {
                <span class="h num">{{ c.hours }}</span>
                @if (c.kind) { <span class="k t-body-sm">{{ c.kind }}</span> }
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .cal { display: grid; gap: var(--space-2); }
    .head, .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-2); }
    .wd { text-align: center; }
    .cell {
      display: grid; align-content: start; gap: 2px; min-height: 5rem; padding: var(--space-2);
      border: 1px solid var(--border); border-radius: var(--radius-field);
      background: var(--surface-raised); color: var(--ink); font: inherit; text-align: left;
    }
    .cell.empty { border-color: transparent; background: transparent; }
    .cell.weekend { background: var(--surface-sunken); color: var(--ink-muted); }
    .cell.blocked { background: var(--brand-tint); color: var(--brand-ink); border-style: dashed; }
    .cell.edit { cursor: pointer; transition: border-color var(--motion), background-color var(--motion); }
    .cell.edit:hover { border-color: var(--brand); background: var(--brand-tint); }
    .cell.edit:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .d { font-weight: 600; }
    .h { font-size: 15px; font-weight: 600; }
    .k { overflow-wrap: anywhere; }
    @media (max-width: 640px) {
      .cell { min-height: 4rem; padding: var(--space-1); }
      .k { font-size: 11px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cell.edit { transition: none; }
    }
  `,
})
export class TimesheetCalendar {
  /** Luna afișată, "YYYY-MM". */
  readonly month = input.required<string>();
  readonly days = input.required<TimesheetDay[]>();
  /** Fals: calendar doar pentru citire (lună trimisă, aprobată sau vizualizare de manager). */
  readonly editable = input(false);
  readonly dayClick = output<string>();

  protected readonly weekdays = WEEKDAYS;
  private readonly today = new Date();

  protected readonly monthLabel = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  });

  protected readonly lead = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay(); // 0 = duminică
    return Array.from({ length: (first + 6) % 7 }, (_, i) => i);
  });

  protected readonly cells = computed<Cell[]>(() => {
    const [y, m] = this.month().split('-').map(Number);
    const count = new Date(y, m, 0).getDate();
    const byDate = new Map(this.days().map((d) => [d.date, d]));
    const out: Cell[] = [];
    for (let day = 1; day <= count; day++) {
      const dt = new Date(y, m - 1, day);
      const iso = toIsoDate(dt);
      const entry = byDate.get(iso) ?? null;
      const blocked = entry?.blocked ? BLOCKED_LABELS[entry.blocked] : '';
      const dow = dt.getDay();
      const hours = entry && entry.minutes !== null ? formatMinutes(entry.minutes) : '';
      const kind = entry?.type && entry.type !== 'LUCRAT' ? ENTRY_TYPE_LABELS[entry.type] : '';
      const editable = !blocked && isEditableDate(dt, this.today);
      const status = blocked || (hours ? `${hours}${kind ? ', ' + kind : ''}` : 'fără pontaj');
      out.push({
        date: iso, day, editable, weekend: dow === 0 || dow === 6, hours, kind, blocked,
        label: `${formatDate(iso)}, ${status}${editable && this.editable() ? ', apasă pentru a edita' : ''}`,
      });
    }
    return out;
  });
}
