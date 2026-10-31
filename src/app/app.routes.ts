import { Routes } from '@angular/router';
import { hasGroupsGuard, memberGuard, ownerGuard } from './core/guards/group.guards';

/**
 * O app vive dentro de um grupo: `/g/:groupId` com as quatro abas. As rotas
 * soltas de antes (`/sessoes`, `/sorteios`, `/historico`…) redirecionam para a
 * lista de vôleis, que é por onde se entra agora.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'voleis',
    pathMatch: 'full',
  },
  {
    path: 'entrar',
    title: 'Entrar num vôlei',
    loadComponent: () => import('./features/entry/join.component').then((m) => m.JoinComponent),
  },
  {
    // O link do convite: abre a tela com o código já preenchido.
    path: 'entrar/:inviteCode',
    title: 'Entrar num vôlei',
    loadComponent: () => import('./features/entry/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'criar',
    title: 'Criar um vôlei',
    loadComponent: () =>
      import('./features/entry/create-group.component').then((m) => m.CreateGroupComponent),
  },
  {
    path: 'voleis',
    title: 'Seus vôleis',
    canActivate: [hasGroupsGuard],
    loadComponent: () =>
      import('./features/groups/group-picker.component').then((m) => m.GroupPickerComponent),
  },
  {
    path: 'g/:groupId',
    canActivate: [memberGuard],
    loadComponent: () =>
      import('./features/group/group-shell.component').then((m) => m.GroupShellComponent),
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      {
        path: 'sou-quem',
        title: 'Quem você é?',
        loadComponent: () =>
          import('./features/group/claim/claim.component').then((m) => m.ClaimComponent),
      },
      {
        path: 'convite',
        title: 'Convite',
        canActivate: [ownerGuard],
        loadComponent: () =>
          import('./features/group/invite/invite.component').then((m) => m.InviteComponent),
      },
      {
        path: 'inicio',
        title: 'Início',
        loadComponent: () =>
          import('./features/group/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'campeonatos',
        title: 'Campeonatos',
        loadChildren: () =>
          import('./features/group/tournaments/tournaments.routes').then(
            (m) => m.TOURNAMENT_ROUTES,
          ),
      },
      {
        path: 'rankings',
        title: 'Rankings',
        loadComponent: () =>
          import('./features/group/rankings/rankings.component').then((m) => m.RankingsComponent),
      },
      {
        path: 'jogadores',
        title: 'Jogadores',
        loadChildren: () =>
          import('./features/group/players/players.routes').then((m) => m.PLAYER_ROUTES),
      },
    ],
  },
  // Rotas antigas: a sessão, o sorteio e o histórico agora moram dentro do grupo.
  { path: 'dashboard', redirectTo: 'voleis' },
  { path: 'sessoes', redirectTo: 'voleis' },
  { path: 'sorteios', redirectTo: 'voleis' },
  { path: 'historico', redirectTo: 'voleis' },
  { path: 'campeonatos', redirectTo: 'voleis' },
  { path: 'rankings', redirectTo: 'voleis' },
  { path: 'jogadores', redirectTo: 'voleis' },
  { path: '**', redirectTo: 'voleis' },
];
