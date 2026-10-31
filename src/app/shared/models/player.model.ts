import { Gender } from '../enums';

/**
 * Um jogador pertence a UM vôlei. Dois vôleis podem ter um "Raul" cada, e eles
 * não têm relação nenhuma — é o que faz cada vôlei ser uma ilha.
 *
 * A data de nascimento não está aqui de propósito: ela funciona como senha e o
 * banco não a entrega a cliente nenhum (ver `revoke select` em
 * `supabase/migrations/`). Ela só é comparada dentro do servidor.
 */
export interface Player {
  id: string;
  groupId: string;
  name: string;
  gender: Gender;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  timesWaited: number;
  winPercentage: number;
}
