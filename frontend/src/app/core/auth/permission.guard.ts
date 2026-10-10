import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Atenție: o rută cu `permissionGuard` fără `data.permissions` rămâne deschisă
 * (protejată doar de authGuard).
 */
/**
 * Citește `route.data.permissions` (listă de coduri). Implicit sunt necesare toate;
 * cu `route.data.permissionsMode: 'any'` este suficient oricare dintre ele.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const required = (route.data['permissions'] as string[] | undefined) ?? [];
  const mode = route.data['permissionsMode'] as 'all' | 'any' | undefined;
  const allowed = mode === 'any' ? auth.hasAny(required) : auth.hasAll(required);
  return allowed ? true : inject(Router).createUrlTree(['/acces-interzis']);
};
