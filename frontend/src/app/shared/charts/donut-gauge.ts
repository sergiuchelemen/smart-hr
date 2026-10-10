import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSegment {
  value: number;
  /** Numele tokenului de culoare, fără `var()`, de ex. `brand`. */
  token: string;
}

interface Arc {
  token: string;
  dash: string;
  offset: number;
}

/** Inel cu arcuri proporționale; valoarea principală apare ca text în centru. */
@Component({
  selector: 'app-donut-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="description()">
        <circle class="track" cx="60" cy="60" r="50" pathLength="100" />
        @for (a of arcs(); track a.token) {
          <circle class="arc" cx="60" cy="60" r="50" pathLength="100" [style.stroke]="'var(--' + a.token + ')'"
            [style.stroke-dasharray]="a.dash" [style.stroke-dashoffset]="a.offset" />
        }
      </svg>
      <div class="center" aria-hidden="true">
        <span class="big num">{{ centerValue() }}</span>
        <span class="t-body-sm t-muted">{{ centerLabel() }}</span>
      </div>
    </div>
  `,
  styles: `
    .wrap { position: relative; width: 168px; aspect-ratio: 1; flex: none; }
    svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    circle { fill: none; stroke-width: 11; }
    .track { stroke: var(--surface-sunken); }
    .arc { stroke-linecap: butt; animation: fill 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
    @keyframes fill { from { stroke-dasharray: 0 100; } }
    .center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
    .big { font-size: 38px; line-height: 42px; font-weight: 600; }
  `,
})
export class DonutGauge {
  readonly segments = input.required<DonutSegment[]>();
  readonly total = input.required<number>();
  readonly centerValue = input.required<string>();
  readonly centerLabel = input.required<string>();
  readonly description = input.required<string>();

  protected readonly arcs = computed<Arc[]>(() => {
    const total = Math.max(this.total(), 1);
    let start = 0;
    const out: Arc[] = [];
    for (const s of this.segments()) {
      const len = Math.min((Math.max(s.value, 0) / total) * 100, 100 - start);
      if (len > 0) {
        out.push({ token: s.token, dash: `${len} ${100 - len}`, offset: -start });
        start += len;
      }
    }
    return out;
  });
}
