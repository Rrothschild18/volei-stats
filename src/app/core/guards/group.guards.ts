import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { CurrentGroupStore } from '../stores/current-group.store';

/** Entra no grupo da rota e resolve o papel. */
async function enterGroup(route: ActivatedRouteSnapshot): Promise<boolean> {
  const store = inject(CurrentGroupStore);
  const groupId = route.paramMap.get('groupId') ?? route.parent?.paramMap.get('groupId');

  if (!groupId) {
    return false;
  }

  // `enter` já evita o retrabalho quando o grupo e a pessoa são os mesmos —
  // e é ele que percebe quando a pessoa mudou.
  return store.enter(groupId);
}

/** Só entra nas telas do grupo quem é membro dele. */
export const memberGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return (await enterGroup(route)) ? true : router.createUrlTree(['/voleis']);
};

/**
 * Presença, sorteio, formato e edição de jogador são do admin. Na UI as ações
 * de admin não renderizam para jogador; o guard é a trava da rota.
 */
export const adminGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const store = inject(CurrentGroupStore);
  const router = inject(Router);

  if (!(await enterGroup(route))) {
    return router.createUrlTree(['/voleis']);
  }

  return store.isAdmin() ? true : router.createUrlTree(['/g', store.groupId(), 'inicio']);
};
