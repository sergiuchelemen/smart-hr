import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LEAVE_STATUS_LABELS, LeaveStatus } from '../../core/leave/leave.service';
import { TIMESHEET_STATUS_LABELS, TimesheetStatus } from '../../core/timesheet/timesheet.service';

type Shape = 'circle' | 'diamond' | 'square' | 'ring';

export type PillStatus = LeaveStatus | 'ACTIVE' | 'DISABLED' | `TS_${TimesheetStatus}`;

const EXTRA_LABELS = { ACTIVE: 'Activ', DISABLED: 'Dezactivat' } as const;

const FEMININE_LABELS = { ACTIVE: 'Activă', DISABLED: 'Dezactivată' } as const;

const VARIANTS: Record<PillStatus, { tone: string; shape: Shape }> = {
  ACTIVE: { tone: 'success', shape: 'circle' },
  DISABLED: { tone: 'neutral', shape: 'ring' },
  TS_DRAFT: { tone: 'neutral', shape: 'ring' },
  TS_SUBMITTED: { tone: 'warning', shape: 'diamond' },
  TS_APPROVED: { tone: 'success', shape: 'circle' },
  TS_REJECTED: { tone: 'danger', shape: 'square' },
  APPROVED: { tone: 'success', shape: 'circle' },
  PENDING: { tone: 'warning', shape: 'diamond' },
  REJECTED: { tone: 'danger', shape: 'square' },
  CANCELLED: { tone: 'neutral', shape: 'ring' },
};

/** Starea se transmite prin cuvânt și formă, nu doar prin culoare. */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [class]="'pill tone-' + variant().tone">
    <span class="shape" [class]="'shape ' + variant().shape" aria-hidden="true"></span>{{ label() }}
  </span>`,
  styles: `
    .pill {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: 2px var(--space-3);
      border-radius: var(--radius-pill);
      font-size: 13px;
      line-height: 20px;
      font-weight: 600;
      white-space: nowrap;
    }
    .tone-success { background: var(--success-tint); color: var(--success-ink); --shape: var(--success); }
    .tone-warning { background: var(--warning-tint); color: var(--warning-ink); --shape: var(--warning); }
    .tone-danger { background: var(--danger-tint); color: var(--danger-ink); --shape: var(--danger); }
    .tone-neutral { background: var(--surface-sunken); color: var(--ink); --shape: var(--ink-muted); }
    .shape { width: 8px; height: 8px; background: var(--shape); flex: none; }
    .circle { border-radius: 50%; }
    .diamond { transform: rotate(45deg); }
    .square { border-radius: 1px; }
    .ring { border-radius: 50%; background: transparent; border: 2px solid var(--shape); }
  `,
})
export class StatusPill {
  readonly status = input.required<PillStatus>();
  /** Acord feminin (Activă, Dezactivată), de ex. pentru companii. */
  readonly feminine = input(false);
  protected readonly label = computed(() => {
    const s = this.status();
    if (s === 'ACTIVE' || s === 'DISABLED') {
      return this.feminine() ? FEMININE_LABELS[s] : EXTRA_LABELS[s];
    }
    if (s.startsWith('TS_')) {
      return TIMESHEET_STATUS_LABELS[s.slice(3) as TimesheetStatus];
    }
    return LEAVE_STATUS_LABELS[s as LeaveStatus];
  });
  protected readonly variant = computed(() => VARIANTS[this.status()]);
}
