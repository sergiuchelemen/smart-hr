import { Injectable, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'smarthr.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  readonly choice = signal<ThemeChoice>(this.readChoice());

  init(): void {
    this.apply();
    this.media.addEventListener('change', () => {
      if (this.choice() === 'system') {
        this.apply();
      }
    });
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
    const dark = this.choice() === 'dark' || (this.choice() === 'system' && this.media.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  private readChoice(): ThemeChoice {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') {
        return v;
      }
    } catch {
      // ignorat
    }
    return 'system';
  }
}
