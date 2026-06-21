import { Routes } from '@angular/router';

export const SESSION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/session-list.component').then(m => m.SessionListComponent),
  },
  {
    path: 'nova',
    loadComponent: () => import('./pages/session-create.component').then(m => m.SessionCreateComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/session-detail.component').then(m => m.SessionDetailComponent),
  },
];
