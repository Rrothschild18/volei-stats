import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
  },
  {
    path: 'jogadores',
    loadChildren: () => import('./features/players/players.routes').then(m => m.PLAYER_ROUTES),
  },
  {
    path: 'sessoes',
    loadChildren: () => import('./features/sessions/sessions.routes').then(m => m.SESSION_ROUTES),
  },
  {
    path: 'sorteios',
    loadChildren: () => import('./features/draws/draws.routes').then(m => m.DRAW_ROUTES),
  },
  {
    path: 'campeonatos',
    loadChildren: () => import('./features/tournaments/tournaments.routes').then(m => m.TOURNAMENT_ROUTES),
  },
  {
    path: 'historico',
    loadChildren: () => import('./features/history/history.routes').then(m => m.HISTORY_ROUTES),
  },
  {
    path: 'rankings',
    loadChildren: () => import('./features/rankings/rankings.routes').then(m => m.RANKING_ROUTES),
  },
];
