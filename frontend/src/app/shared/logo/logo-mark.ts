import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" xmlns="http://www.w3.org/2000/svg"
         [attr.role]="decorative() ? null : 'img'" [attr.aria-label]="decorative() ? null : 'Smart HR'"
         [attr.aria-hidden]="decorative() ? 'true' : null" focusable="false">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <rect x="17" y="16" width="8" height="32" rx="4" fill="var(--on-brand)" />
      <rect x="39" y="16" width="8" height="32" rx="4" fill="var(--on-brand)" />
      <circle cx="32" cy="32" r="5.5" fill="var(--on-brand)" />
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; line-height: 0; }
    svg { display: block; }
  `,
})
export class LogoMark {
  /** Latura semnului în pixeli (minim recomandat 16). */
  readonly size = input(32);
  /** True când semnul stă lângă text. */
  readonly decorative = input(false);
}
