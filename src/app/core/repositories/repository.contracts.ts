import { Gender } from '../../shared/enums';
import {
  DrawProposal,
  Group,
  GroupMember,
  Match,
  Player,
  PlayerStats,
  Session,
  TeamStats,
  Tournament,
} from '../../shared/models';

/**
 * O que as telas podem pedir aos dados, sem saber de onde eles vêm.
 *
 * São classes abstratas, não interfaces, porque também servem de token de
 * injeção: quem escolhe a implementação é `provideSupabaseData()` ou
 * `provideDemoData()`, uma vez, na configuração do app.
 *
 * As assinaturas nasceram do banco do navegador, onde ler tudo era grátis. As
 * implementações contra o Postgres mantêm a mesma forma, mas nenhuma delas lê
 * mais do que o vôlei de quem está olhando — as políticas do banco não
 * deixariam.
 */
export abstract class GroupRepository {
  abstract getAll(): Promise<Group[]>;
  abstract getById(id: string): Promise<Group | undefined>;
  abstract save(group: Group): Promise<Group>;
  abstract getAllMembers(): Promise<GroupMember[]>;
  abstract getMembersByGroupId(groupId: string): Promise<GroupMember[]>;
  abstract getMembershipsByPlayerId(playerId: string): Promise<GroupMember[]>;
  abstract saveMember(member: GroupMember): Promise<GroupMember>;
}

export abstract class PlayerRepository {
  abstract getAll(): Promise<Player[]>;
  /**
   * Cadastrar é separado de salvar porque no banco é outra operação: o cliente
   * não insere jogador, pede ao servidor que insira. A data de nascimento é
   * senha de primeiro acesso, e quem a define é o banco.
   */
  abstract create(groupId: string, name: string, gender: Gender): Promise<Player>;
  abstract getByGroupId(groupId: string): Promise<Player[]>;
  abstract getById(id: string): Promise<Player | undefined>;
  abstract save(player: Player): Promise<Player>;
  abstract delete(id: string): Promise<void>;
}

export abstract class SessionRepository {
  abstract getAll(): Promise<Session[]>;
  abstract getByGroupId(groupId: string): Promise<Session[]>;
  abstract getById(id: string): Promise<Session | undefined>;
  abstract save(session: Session): Promise<Session>;
  abstract delete(id: string): Promise<void>;
}

export abstract class DrawRepository {
  abstract getAll(): Promise<DrawProposal[]>;
  abstract getBySessionId(sessionId: string): Promise<DrawProposal[]>;
  abstract getById(id: string): Promise<DrawProposal | undefined>;
  abstract save(draw: DrawProposal): Promise<DrawProposal>;
  abstract delete(id: string): Promise<void>;
}

export abstract class TournamentRepository {
  abstract getAll(): Promise<Tournament[]>;
  abstract getBySessionId(sessionId: string): Promise<Tournament[]>;
  abstract getById(id: string): Promise<Tournament | undefined>;
  abstract save(tournament: Tournament): Promise<Tournament>;
  abstract delete(id: string): Promise<void>;
}

export abstract class MatchRepository {
  abstract getAll(): Promise<Match[]>;
  abstract getByTournamentId(tournamentId: string): Promise<Match[]>;
  abstract getBySessionId(sessionId: string): Promise<Match[]>;
  abstract getById(id: string): Promise<Match | undefined>;
  abstract save(match: Match): Promise<Match>;
  abstract delete(id: string): Promise<void>;
}

/**
 * Os rankings do vôlei, somados por quem tem os dados.
 *
 * Existe separado dos outros repositórios porque não é leitura de tabela: no
 * banco são views, que contam no servidor — uma consulta em vez de carregar
 * todas as partidas do vôlei no navegador para somar aqui.
 *
 * O perfil de uma pessoa continua montado na tela, a partir dos jogos dela:
 * ali o custo é pequeno e os números são os mesmos.
 */
export abstract class StatsRepository {
  abstract playerStats(groupId: string): Promise<readonly PlayerStats[]>;
  abstract teamStats(groupId: string): Promise<readonly TeamStats[]>;
}
