import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, forwardRef, inject, input, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALUE_ACCESSOR, ValidationErrors } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX_BYTES = 72;

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';
const LENGTH = 20;

/** Număr întreg uniform în [0, max), fără părtinire de modulo. */
function randomBelow(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Parolă aleatoare cu `crypto.getRandomValues`: cel puțin o literă mică, una mare, o cifră și un simbol. */
export function generatePassword(): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [LOWER, UPPER, DIGITS, SYMBOLS].map((set) => set[randomBelow(set.length)]);
  while (chars.length < LENGTH) {
    chars.push(all[randomBelow(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Aceleași limite ca în backend: cel puțin 12 caractere, cel mult 72 de octeți UTF-8. */
export function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const v = (control.value as string | null) ?? '';
  if (v.length < PASSWORD_MIN) {
    return { minlength: true };
  }
  if (new TextEncoder().encode(v).length > PASSWORD_MAX_BYTES) {
    return { maxbytes: true };
  }
  return null;
}

/**
 * Câmp de parolă cu Generează, Copiază și Afișează/Ascunde. Valoarea este ținută doar în câmpul
 * nativ și în control (nu în semnale) și se golește la distrugerea componentei.
 */
@Component({
  selector: 'app-password-input',
  imports: [ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordInput), multi: true }],
  template: `
    <div class="row">
      <input pInputText class="field-input" [id]="inputId()" [type]="visible() ? 'text' : 'password'"
             [value]="text" [disabled]="disabled()" autocomplete="new-password" autocapitalize="off"
             spellcheck="false" [attr.aria-invalid]="invalid() ? 'true' : null"
             [attr.aria-describedby]="describedBy()"
             (input)="onInput($event)" (blur)="touched()" />
      <p-button class="row-action" [label]="visible() ? 'Ascunde' : 'Afișează'" severity="secondary" [outlined]="true"
                [ariaLabel]="visible() ? 'Ascunde parola' : 'Afișează parola'" [disabled]="disabled()"
                (onClick)="visible.set(!visible())" />
      <p-button class="row-action" label="Generează" severity="secondary" [outlined]="true"
                ariaLabel="Generează o parolă aleatoare" [disabled]="disabled()" (onClick)="generate()" />
      <p-button class="row-action" label="Copiază" severity="secondary" [outlined]="true"
                ariaLabel="Copiază parola în clipboard" [disabled]="disabled() || !hasText()" (onClick)="copy()" />
    </div>
    <p class="t-body-sm t-muted live" aria-live="polite">{{ feedback() }}</p>
  `,
  styles: `
    :host { display: grid; gap: var(--space-1); }
    .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
    .field-input { flex: 1 1 14rem; min-width: 0; font-variant-ligatures: none; }
    .live { min-height: 20px; }
  `,
})
export class PasswordInput implements ControlValueAccessor, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly inputId = input.required<string>();
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  protected text = '';
  protected readonly visible = signal(false);
  protected readonly disabled = signal(false);
  protected readonly feedback = signal('');
  protected readonly hasText = signal(false);

  private onChange: (v: string) => void = () => undefined;
  protected touched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.text = value ?? '';
    this.hasText.set(this.text.length > 0);
    if (!this.text) {
      this.visible.set(false);
      this.feedback.set('');
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  ngOnDestroy(): void {
    this.text = '';
    this.onChange = () => undefined;
  }

  protected onInput(event: Event): void {
    this.set((event.target as HTMLInputElement).value);
    this.feedback.set('');
  }

  protected generate(): void {
    this.set(generatePassword());
    this.visible.set(true);
    this.feedback.set('Parolă generată. Copiază-o înainte de a salva: nu va mai fi afișată.');
  }

  protected async copy(): Promise<void> {
    if (!this.text) {
      return;
    }
    let ok = false;
    try {
      await navigator.clipboard.writeText(this.text);
      ok = true;
    } catch {
      ok = this.legacyCopy(this.text);
    }
    this.feedback.set(ok ? 'Parola a fost copiată.' : 'Nu am putut copia. Selectează parola și copiază-o manual.');
  }

  private set(value: string): void {
    this.text = value;
    this.hasText.set(value.length > 0);
    this.onChange(value);
    this.cdr.markForCheck();
  }

  private legacyCopy(value: string): boolean {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.value = '';
    area.remove();
    return ok;
  }
}
