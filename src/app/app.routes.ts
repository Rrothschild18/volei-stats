import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'jogadores',
    title: 'Jogadores',
    loadChildren: () => import('./features/players/players.routes').then((m) => m.PLAYER_ROUTES),
  },
  {
    path: 'sessoes',
    title: 'Sessões',
    loadChildren: () => import('./features/sessions/sessions.routes').then((m) => m.SESSION_ROUTES),
  },
  {
    path: 'sorteios',
    title: 'Sorteios',
    loadChildren: () => import('./features/draws/draws.routes').then((m) => m.DRAW_ROUTES),
  },
  {
    path: 'campeonatos',
    title: 'Campeonatos',
    loadChildren: () =>
      import('./features/tournaments/tournaments.routes').then((m) => m.TOURNAMENT_ROUTES),
  },
  {
    path: 'historico',
    title: 'Histórico',
    loadChildren: () => import('./features/history/history.routes').then((m) => m.HISTORY_ROUTES),
  },
  {
    path: 'rankings',
    title: 'Rankings',
    loadChildren: () => import('./features/rankings/rankings.routes').then((m) => m.RANKING_ROUTES),
  },
];
