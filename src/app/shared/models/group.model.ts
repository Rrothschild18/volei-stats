/**
 * Um grupo é um vôlei: "Vôlei Segunda", "Vôlei Trabalho". A pessoa participa de
 * vários, e o papel vale por grupo (REGRAS.md e docs/PLANO-SUPABASE.md).
 */
export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export type GroupRole = 'admin' | 'player';

export interface GroupMember {
  id: string;
  groupId: string;
  playerId: string;
  role: GroupRole;
}
