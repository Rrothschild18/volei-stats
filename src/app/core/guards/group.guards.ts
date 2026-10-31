import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { CurrentGroupStore } from '../stores/current-group.store';

/** Entra no vôlei da rota e resolve o papel. */
async function enterGroup(route: ActivatedRouteSnapshot): Promise<boolean> {
  const store = inject(CurrentGroupStore);
  const groupId = route.paramMap.get('groupId') ?? route.parent?.paramMap.get('groupId');

  if (!groupId) {
    return false;
  }

  // `enter` já evita o retrabalho quando o vôlei e a pessoa são os mesmos —
  // e é ele que percebe quando a pessoa mudou.
  return store.enter(groupId);
}

/** Só entra nas telas do vôlei quem é membro dele. */
export const memberGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return (await enterGroup(route)) ? true : router.createUrlTree(['/voleis']);
};

/**
 * Presença, sorteio, formato e decisões de quadra são de qualquer jogador: o
 * dono pode estar jogando a final, ou ter faltado, e o sorteio não espera.
 *
 * Quem ainda não reivindicou um nome (espectador) não escreve.
 */
export const playerGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const store = inject(CurrentGroupStore);
  const router = inject(Router);

  if (!(await enterGroup(route))) {
    return router.createUrlTree(['/voleis']);
  }

  return store.canPlay() ? true : router.createUrlTree(['/g', store.groupId(), 'inicio']);
};

/** Cadastrar jogador, gerar o link e apagar coisa continuam sendo do dono. */
export const ownerGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const store = inject(CurrentGroupStore);
  const router = inject(Router);

  if (!(await enterGroup(route))) {
    return router.createUrlTree(['/voleis']);
  }

  return store.isOwner() ? true : router.createUrlTree(['/g', store.groupId(), 'inicio']);
};
