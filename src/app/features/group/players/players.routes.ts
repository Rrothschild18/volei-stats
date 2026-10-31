import { Routes } from '@angular/router';
import { adminGuard } from '../../../core/guards/group.guards';

export const PLAYER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./player-list.component').then((m) => m.PlayerListComponent),
  },
  {
    path: 'novo',
    title: 'Novo jogador',
    canActivate: [adminGuard],
    loadComponent: () => import('./player-form.component').then((m) => m.PlayerFormComponent),
  },
  {
    path: ':playerId',
    title: 'Perfil',
    loadComponent: () => import('./player-detail.component').then((m) => m.PlayerDetailComponent),
  },
  {
    path: ':playerId/editar',
    title: 'Editar jogador',
    canActivate: [adminGuard],
    loadComponent: () => import('./player-form.component').then((m) => m.PlayerFormComponent),
  },
];
