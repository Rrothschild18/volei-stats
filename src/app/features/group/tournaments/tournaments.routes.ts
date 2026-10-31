import { Routes } from '@angular/router';
import { adminGuard } from '../../../core/guards/group.guards';

/** As rotas específicas vêm antes de `:tournamentId`, que casa com qualquer coisa. */
export const TOURNAMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tournament-list.component').then((m) => m.TournamentListComponent),
  },
  {
    path: 'sessoes/nova',
    title: 'Nova sessão',
    canActivate: [adminGuard],
    loadComponent: () => import('./session-create.component').then((m) => m.SessionCreateComponent),
  },
  {
    path: 'sessoes/:sessionId',
    title: 'Sessão do dia',
    loadComponent: () => import('./session-detail.component').then((m) => m.SessionDetailComponent),
  },
  {
    path: 'sessoes/:sessionId/sorteio',
    title: 'Sorteio',
    canActivate: [adminGuard],
    loadComponent: () => import('./draw.component').then((m) => m.DrawComponent),
  },
  {
    path: 'novo',
    title: 'Formato',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./tournament-create.component').then((m) => m.TournamentCreateComponent),
  },
  {
    path: ':tournamentId',
    title: 'Campeonato',
    loadComponent: () =>
      import('./tournament-live.component').then((m) => m.TournamentLiveComponent),
  },
  {
    path: ':tournamentId/classificacao',
    title: 'Classificação',
    loadComponent: () => import('./standings.component').then((m) => m.StandingsComponent),
  },
];
