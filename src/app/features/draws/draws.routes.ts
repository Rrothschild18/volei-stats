import { Routes } from '@angular/router';

export const DRAW_ROUTES: Routes = [
  {
    path: 'novo',
    loadComponent: () => import('./pages/draw-generate.component').then(m => m.DrawGenerateComponent),
  },
];
