export const DB_NAME = 'volei-stats-db';
/** v2: grupos e papéis por grupo (docs/PLANO-SUPABASE.md). */
export const DB_VERSION = 2;

export const STORES = {
  PLAYERS: 'players',
  SESSIONS: 'sessions',
  DRAWS: 'draws',
  TOURNAMENTS: 'tournaments',
  MATCHES: 'matches',
  GROUPS: 'groups',
  GROUP_MEMBERS: 'group_members',
} as const;
