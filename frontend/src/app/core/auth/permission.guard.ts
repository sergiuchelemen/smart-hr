import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Atenție: o rută cu `permissionGuard` fără `data.permissions` rămâne deschisă
 * (protejată doar de authGuard).
 */
/** Citește `route.data.permissions` (listă de coduri); sunt necesare toate. */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const required = (route.data['permissions'] as string[] | undefined) ?? [];
  return auth.hasAll(required) ? true : inject(Router).createUrlTree(['/acces-interzis']);
};
