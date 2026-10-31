import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { IdentityService } from '../identity';
import { CurrentGroupStore } from '../stores/current-group.store';

/**
 * Entra no vôlei da rota e resolve o papel.
 *
 * Falha de leitura conta como "não é membro", e não como exceção. Um guard que
 * REJEITA não navega para lugar nenhum: o Angular emite um `NavigationError` e a
 * tela fica branca. Abrir o app em modo avião fazia exatamente isso — e assim
 * nem chegava a rodar o tratamento de "sem conexão" que as telas têm.
 */
async function enterGroup(route: ActivatedRouteSnapshot): Promise<boolean> {
  const store = inject(CurrentGroupStore);
  const groupId = route.paramMap.get('groupId') ?? route.parent?.paramMap.get('groupId');

  if (!groupId) {
    return false;
  }

  try {
    // `enter` já evita o retrabalho quando o vôlei e a pessoa são os mesmos —
    // e é ele que percebe quando a pessoa mudou.
    return await store.enter(groupId);
  } catch {
    return false;
  }
}

/** Os meus vôleis, ou nenhum se a leitura falhou — nunca uma exceção. */
async function myGroupCount(): Promise<number> {
  const identity = inject(IdentityService);
  try {
    return (await identity.myGroups()).length;
  } catch {
    return 0;
  }
}

/** Só entra nas telas do vôlei quem é membro dele. */
export const memberGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return (await enterGroup(route)) ? true : router.createUrlTree(['/entrar']);
};

/**
 * Quem não tem vôlei nenhum não tem lista para ver: cai na tela de entrar.
 *
 * É só isto que decide a primeira tela do app — `/` manda para `/voleis`, e
 * daqui a pessoa segue para a lista ou para a porta. A tela de entrar continua
 * aberta a quem já participa de algo: entrar num SEGUNDO vôlei é o caso normal.
 */
export const hasGroupsGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const count = await myGroupCount();
  return count > 0 ? true : router.createUrlTree(['/entrar']);
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
