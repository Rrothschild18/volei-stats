import { Routes } from '@angular/router';

export const HISTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/history-list.component').then(m => m.HistoryListComponent),
  },
];
