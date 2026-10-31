import { Gender } from '../../shared/enums';

export interface CreatedGroup {
  readonly groupId: string;
  readonly playerId: string;
  readonly inviteCode: string;
}

export interface UnclaimedPlayer {
  readonly id: string;
  readonly name: string;
  readonly gender: Gender;
}

export interface Invite {
  readonly code: string;
  readonly revoked: boolean;
}

/** Por que a tentativa de dizer quem eu sou não deu certo. */
export type ClaimFailure =
  /** Nome que não existe OU data errada. É o mesmo motivo de propósito. */
  | 'not-found'
  /** Primeira entrada: a data nova é obrigatória. */
  | 'new-date-required'
  /** A data nova não pode ser a mesma que o grupo combinou. */
  | 'new-date-must-differ'
  /** Cinco erros em quinze minutos. */
  | 'too-many-tries';

/** Por que a troca da própria data não deu certo. */
export type BirthDateFailure =
  /** A data atual informada não é a que está guardada. */
  | 'wrong-current'
  /** A nova não pode ser a que o grupo combinou: é a senha de todos. */
  | 'same-as-group'
  /** Cinco erros em quinze minutos. */
  | 'too-many-tries';

export type BirthDateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: BirthDateFailure };

export type ClaimResult =
  | { readonly ok: true; readonly playerId: string }
  | { readonly ok: false; readonly failure: ClaimFailure };

/**
 * Entrar num vôlei: criar o seu, usar o código de um, e dizer quem você é.
 *
 * Tudo aqui é operação de servidor, e não escrita em tabela, por um motivo só:
 * a data de nascimento é senha. Ela nunca sai do banco e nunca é escolhida pelo
 * cliente — só comparada lá dentro.
 */
export abstract class MembershipService {
  abstract createGroup(input: {
    groupName: string;
    ownerName: string;
    ownerGender: Gender;
    ownerBirthDate: string;
    initialBirthDate: string;
  }): Promise<CreatedGroup>;

  /** Usa o código e entra no vôlei como visitante. */
  abstract redeemCode(code: string): Promise<{ groupId: string; groupName: string }>;

  /** Os nomes que ninguém reivindicou ainda. */
  abstract unclaimedPlayers(groupId: string): Promise<readonly UnclaimedPlayer[]>;

  /**
   * Diz quem eu sou. Na primeira vez a data é a que o grupo combinou, e trocar
   * pela sua é obrigatório na mesma chamada. Depois disso, é a sua.
   */
  abstract claim(input: {
    groupId: string;
    name: string;
    birthDate: string;
    newBirthDate: string | null;
  }): Promise<ClaimResult>;

  /**
   * Troca o meu nome neste vôlei. Quem cadastrou escreveu o nome grosso; quem
   * sabe como quer ser chamado é a pessoa.
   */
  abstract renameMe(groupId: string, name: string): Promise<void>;

  /**
   * Troca a minha data, sabendo a atual. A velha é exigida porque a sessão é a
   * única credencial: sem ela, um celular emprestado trancaria a pessoa fora
   * dos aparelhos dela.
   */
  abstract changeMyBirthDate(input: {
    groupId: string;
    current: string;
    next: string;
  }): Promise<BirthDateResult>;

  /** O convite do vôlei: o que o dono manda no grupo do zap. */
  abstract invite(groupId: string): Promise<Invite | null>;
  abstract setInviteCode(groupId: string, code: string): Promise<Invite>;
  /** Cancela o convite atual e gera outro, com código novo. */
  abstract renewInvite(groupId: string): Promise<Invite>;

  /** Devolve a data de alguém para a inicial do vôlei. Só o dono. */
  abstract resetBirthDate(playerId: string): Promise<void>;

  /** Passa o vôlei para outro jogador. Só o dono. */
  abstract transferOwnership(groupId: string, playerId: string): Promise<void>;

  /** Se este jeito de entrar existe no modo em que o app está rodando. */
  abstract readonly available: boolean;
}
