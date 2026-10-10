import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { LoginRequest, MeResponse, TokenPayload, TokenResponse } from './auth.models';

const TOKEN_KEY = 'smarthr.token';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly token = signal<string | null>(this.readStoredToken());
  readonly user = signal<MeResponse | null>(null);

  private readonly payload = computed(() => decodePayload(this.token()));
  readonly permissions = computed<string[]>(() => this.payload()?.perms ?? []);
  readonly isAuthenticated = computed(() => this.token() !== null);

  constructor() {
    this.scheduleExpiry();
  }

  login(request: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>('/api/auth/login', request).pipe(
      tap((res) => this.setToken(res.accessToken)),
    );
  }

  async loadUser(): Promise<void> {
    if (!this.token()) {
      return;
    }
    try {
      this.user.set(await firstValueFrom(this.http.get<MeResponse>('/api/me')));
    } catch {
      // 401 este tratat de interceptor; alte erori lasă utilizatorul necompletat
    }
  }

  logout(redirect = true): void {
    this.clearExpiry();
    this.token.set(null);
    this.user.set(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignorat
    }
    if (redirect) {
      void this.router.navigateByUrl('/login');
    }
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAll(permissions: readonly string[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  private setToken(token: string): void {
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
    const exp = decodePayload(stored)?.exp;
    if (!stored || !exp || exp * 1000 <= Date.now()) {
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
    const exp = this.payload()?.exp;
    if (!exp) {
      return;
    }
    // setTimeout acceptă cel mult ~24,8 zile
    const ms = Math.min(exp * 1000 - Date.now(), 2_147_000_000);
    this.expiryTimer = setTimeout(() => this.logout(), Math.max(ms, 0));
  }

  private clearExpiry(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
