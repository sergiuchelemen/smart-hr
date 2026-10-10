import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PlatformAuthService } from '../platform-auth/platform-auth.service';
import { AuthService } from './auth.service';

/** Zona de platformă folosește doar tokenul de platformă, restul doar tokenul de companie. */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const platform = inject(PlatformAuthService);
  const isApi = req.url.startsWith('/api/');
  const isPlatform = req.url.startsWith('/api/platform/');
  const isLogin = req.url.endsWith('/api/auth/login') || req.url.endsWith('/api/platform/auth/login');
  const token = isPlatform ? platform.token() : auth.token();
  const request =
    token && isApi && !isLogin
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && isApi && !isLogin) {
        if (isPlatform) {
          platform.logout();
        } else {
          auth.logout();
        }
      }
      return throwError(() => err);
    }),
  );
};
