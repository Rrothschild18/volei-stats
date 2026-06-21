import { Gender } from '../enums';

export interface Player {
  id: string;
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
