import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { TokenPayload, TokenResponse } from '../auth/auth.models';

const TOKEN_KEY = 'smarthr.platform.token';
const EXPIRY_SKEW_MS = 5000;

function decodePayload(token: string | null): TokenPayload | null {
  if (!token) {
    return null;
  }
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TokenPayload;
  } catch {
    return null;
  }
}

function isValidPlatformToken(token: string | null): boolean {
  const p = decodePayload(token);
  return !!token && p?.typ === 'platform' && !!p.exp && p.exp * 1000 > Date.now();
}

/** Sesiunea adminului de platformă: cheie, semnal și expirare separate de cele ale companiei. */
@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly token = signal<string | null>(this.readStoredToken());
  readonly isAuthenticated = computed(() => this.token() !== null);

  constructor() {
    this.scheduleExpiry();
  }

  login(request: { email: string; password: string }): Observable<TokenResponse> {
    return this.http.post<TokenResponse>('/api/platform/auth/login', request).pipe(
      tap((res) => this.setToken(res.accessToken)),
    );
  }

  logout(redirect = true): void {
    this.clearExpiry();
    this.token.set(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignorat
    }
    if (redirect) {
      void this.router.navigateByUrl('/platform/login');
    }
  }

  private setToken(token: string): void {
    if (!isValidPlatformToken(token)) {
      throw new Error('Token invalid');
    }
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // sesiune doar în memorie dacă stocarea e blocată
    }
    this.token.set(token);
    this.scheduleExpiry();
  }

  private readStoredToken(): string | null {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
    if (!stored) {
      return null;
    }
    if (!isValidPlatformToken(stored)) {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        // ignorat
      }
      return null;
    }
    return stored;
  }

  private scheduleExpiry(): void {
    this.clearExpiry();
    const exp = decodePayload(this.token())?.exp;
    if (!exp) {
      return;
    }
    const ms = Math.min(exp * 1000 - Date.now() + EXPIRY_SKEW_MS, 2_147_000_000);
    this.expiryTimer = setTimeout(() => this.logout(), Math.max(ms, 0));
  }

  private clearExpiry(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
