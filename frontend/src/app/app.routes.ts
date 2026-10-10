import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'acasa' },
      {
        path: 'acasa',
        loadComponent: () => import('./pages/acasa/acasa').then((m) => m.AcasaPage),
      },
      {
        path: 'angajati',
        canActivate: [permissionGuard],
        data: { permissions: ['EMPLOYEE_READ'] },
        loadComponent: () => import('./pages/angajati/angajati').then((m) => m.AngajatiPage),
      },
      {
        path: 'acces-interzis',
        loadComponent: () =>
          import('./pages/acces-interzis/acces-interzis').then((m) => m.AccesInterzisPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/negasit/negasit').then((m) => m.NegasitPage),
  },
];
