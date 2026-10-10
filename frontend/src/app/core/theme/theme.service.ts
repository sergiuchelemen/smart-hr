import { Injectable, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark';

const STORAGE_KEY = 'smarthr.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly choice = signal<ThemeChoice>(this.readChoice());

  init(): void {
    this.apply();
  }

  set(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // stocarea poate fi blocată; alegerea rămâne valabilă doar în sesiune
    }
    this.apply();
  }

  private apply(): void {
    document.documentElement.setAttribute('data-theme', this.choice());
  }

  private readChoice(): ThemeChoice {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') {
        return v;
      }
    } catch {
      // ignorat
    }
    return 'light';
  }
}
