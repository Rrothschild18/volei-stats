/**
 * Um grupo é um vôlei: "Vôlei Segunda", "Vôlei Trabalho". A pessoa participa de
 * vários, e cada um é uma ilha — os jogadores de um não têm relação com os de
 * outro (docs/PLANO-SUPABASE.md §1).
 */
export interface Group {
  id: string;
  name: string;
  /**
   * O dono, que é quem criou o vôlei ou quem o recebeu. Espelha
   * `groups.owner_player_id`: ser dono não é um papel, é esta coluna — então o
   * vôlei nunca fica sem dono e a propriedade acompanha o jogador, não o
   * navegador.
   */
  ownerPlayerId: string;
  createdAt: string;
}

/**
 * O papel diz uma coisa só: se a pessoa já disse quem é.
 *
 *   viewer — abriu o link e ainda não reivindicou um nome; lê e não escreve
 *   player — reivindicou, e a partir daí faz tudo que é jogo
 *
 * Mandar no cadastro e apagar coisa é do dono, que é `Group.ownerPlayerId`.
 */
export type GroupRole = 'player' | 'viewer';

export interface GroupMember {
  id: string;
  groupId: string;
  playerId: string;
  role: GroupRole;
}
