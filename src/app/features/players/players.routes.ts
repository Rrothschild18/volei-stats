import { Routes } from '@angular/router';

export const PLAYER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/player-list.component').then(m => m.PlayerListComponent),
  },
  {
    path: 'novo',
    loadComponent: () => import('./pages/player-form.component').then(m => m.PlayerFormComponent),
  },
  {
    path: ':id/editar',
    loadComponent: () => import('./pages/player-form.component').then(m => m.PlayerFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/player-detail.component').then(m => m.PlayerDetailComponent),
  },
];
