import { GroupRole } from '../../shared/models';

/**
 * Um vôlei de quem está usando o app, com o papel dele dentro dele.
 *
 * Espelha a view `my_groups`: ela existe para que a primeira tela seja UMA
 * requisição, e não uma por vôlei mais uma por jogador.
 */
export interface MyGroup {
  readonly groupId: string;
  readonly name: string;
  readonly role: GroupRole;
  /** Nulo enquanto a pessoa não disse quem é neste vôlei. */
  readonly playerId: string | null;
  readonly isOwner: boolean;
  readonly todaySessionId: string | null;
  readonly playerCount: number;
  readonly lastSessionDate: string | null;
}

/**
 * Quem está usando o app, e o que ele é em cada vôlei.
 *
 * A pergunta não tem resposta global: a mesma pessoa é dona de um vôlei,
 * jogadora de outro e visitante de um terceiro. Então não existe "o usuário" —
 * existe o que ele é em cada vôlei, e é isso que esta interface responde.
 */
export abstract class IdentityService {
  abstract myGroups(): Promise<readonly MyGroup[]>;
  abstract myGroup(groupId: string): Promise<MyGroup | null>;
  /** Esquece quem é neste navegador. */
  abstract forget(): Promise<void>;
}
