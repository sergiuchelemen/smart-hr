import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { jwtInterceptor } from './core/auth/jwt.interceptor';
import { ThemeService } from './core/theme/theme.service';
import { SmartHrPreset } from './theme-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    providePrimeNG({
      ripple: false,
      theme: {
        preset: SmartHrPreset,
        options: { darkModeSelector: '[data-theme="dark"]', cssLayer: false },
      },
    }),
    provideAppInitializer(() => {
      inject(ThemeService).init();
      return inject(AuthService).loadUser();
    }),
  ],
};
