import { Routes } from '@angular/router';

export const RANKING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ranking-individual.component').then(m => m.RankingIndividualComponent),
  },
  {
    path: 'duplas',
    loadComponent: () => import('./pages/ranking-teams.component').then(m => m.RankingTeamsComponent),
  },
];
