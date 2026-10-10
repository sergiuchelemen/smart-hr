import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isLogin = req.url.endsWith('/api/auth/login');
  const isApi = req.url.startsWith('/api/');
  const request =
    token && isApi && !isLogin
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && isApi && !isLogin) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
