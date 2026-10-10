import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { platformAuthGuard, platformGuestGuard } from './core/platform-auth/platform-auth.guard';
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
        path: 'organizatie',
        canActivate: [permissionGuard],
        data: { permissions: ['EMPLOYEE_READ', 'ORG_MANAGE'], permissionsMode: 'any' },
        loadComponent: () =>
          import('./pages/organizatie/organizatie').then((m) => m.OrganizatiePage),
      },
      {
        path: 'concedii',
        canActivate: [permissionGuard],
        data: { permissions: ['LEAVE_REQUEST'] },
        loadComponent: () => import('./pages/concedii/concedii').then((m) => m.ConcediiPage),
      },
      {
        path: 'concedii/toate',
        canActivate: [permissionGuard],
        data: { permissions: ['LEAVE_READ_ALL'] },
        loadComponent: () =>
          import('./pages/toate-cererile/toate-cererile').then((m) => m.ToateCererilePage),
      },
      {
        path: 'aprobari',
        canActivate: [permissionGuard],
        data: { permissions: ['LEAVE_APPROVE', 'LEAVE_APPROVE_ALL'], permissionsMode: 'any' },
        loadComponent: () => import('./pages/aprobari/aprobari').then((m) => m.AprobariPage),
      },
      {
        path: 'pontaj',
        canActivate: [permissionGuard],
        data: { permissions: ['TIMESHEET_SUBMIT'] },
        loadComponent: () => import('./pages/pontaj/pontaj').then((m) => m.PontajPage),
      },
      {
        path: 'pontaj-echipa',
        canActivate: [permissionGuard],
        data: {
          permissions: ['TIMESHEET_APPROVE', 'TIMESHEET_APPROVE_ALL', 'TIMESHEET_READ_ALL'],
          permissionsMode: 'any',
        },
        loadComponent: () =>
          import('./pages/pontaj-echipa/pontaj-echipa').then((m) => m.PontajEchipaPage),
      },
      {
        path: 'documente',
        loadComponent: () => import('./pages/documente/documente').then((m) => m.DocumentePage),
      },
      {
        path: 'admin/utilizatori',
        canActivate: [permissionGuard],
        data: { permissions: ['USER_READ', 'USER_MANAGE'], permissionsMode: 'any' },
        loadComponent: () =>
          import('./pages/admin/utilizatori/utilizatori').then((m) => m.UtilizatoriPage),
      },
      {
        path: 'admin/roluri',
        canActivate: [permissionGuard],
        data: { permissions: ['ROLE_MANAGE'] },
        loadComponent: () => import('./pages/admin/roluri/roluri').then((m) => m.RoluriPage),
      },
      {
        path: 'acces-interzis',
        loadComponent: () =>
          import('./pages/acces-interzis/acces-interzis').then((m) => m.AccesInterzisPage),
      },
    ],
  },
  {
    path: 'platform/login',
    canActivate: [platformGuestGuard],
    loadComponent: () =>
      import('./pages/platform-login/platform-login').then((m) => m.PlatformLoginPage),
  },
  {
    path: 'platform',
    canActivate: [platformAuthGuard],
    loadComponent: () =>
      import('./layout/platform-shell/platform-shell').then((m) => m.PlatformShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'companii' },
      {
        path: 'companii',
        loadComponent: () =>
          import('./pages/platform-companii/platform-companii').then((m) => m.PlatformCompaniiPage),
      },
      {
        path: 'companii/:id',
        loadComponent: () =>
          import('./pages/platform-companie/platform-companie').then((m) => m.PlatformCompaniePage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/negasit/negasit').then((m) => m.NegasitPage),
  },
];
