import { Routes } from '@angular/router';

export const TOURNAMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/tournament-list.component').then(m => m.TournamentListComponent),
  },
  {
    path: 'novo',
    loadComponent: () => import('./pages/tournament-create.component').then(m => m.TournamentCreateComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/tournament-detail.component').then(m => m.TournamentDetailComponent),
  },
];
