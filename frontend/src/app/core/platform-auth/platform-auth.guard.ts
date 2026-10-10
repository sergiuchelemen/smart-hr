import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlatformAuthService } from './platform-auth.service';

export const platformAuthGuard: CanActivateFn = () => {
  const auth = inject(PlatformAuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/platform/login']);
};

export const platformGuestGuard: CanActivateFn = () => {
  const auth = inject(PlatformAuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/platform/companii']) : true;
};
