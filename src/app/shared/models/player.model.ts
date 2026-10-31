import { Gender } from '../enums';

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  /** Recupera o acesso junto com o nome (docs/PLANO-SUPABASE.md). */
  birthDate: string | null;
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
