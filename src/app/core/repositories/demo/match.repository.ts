import { Injectable, inject } from '@angular/core';
import { MatchRepository, ScoreCorrection } from '../repository.contracts';
import { DemoDbService, STORES } from '../../demo/demo-db.service';
import { Match } from '../../../shared/models';

@Injectable()
export class DemoMatchRepository extends MatchRepository {
  private db = inject(DemoDbService);

  override async getAll(): Promise<Match[]> {
    return this.db.getAll<Match>(STORES.MATCHES);
  }

  override async getByTournamentId(tournamentId: string): Promise<Match[]> {
    return this.db.getByIndex<Match>(STORES.MATCHES, 'tournamentId', tournamentId);
  }

  override async getBySessionId(sessionId: string): Promise<Match[]> {
    return this.db.getByIndex<Match>(STORES.MATCHES, 'sessionId', sessionId);
  }

  override async getById(id: string): Promise<Match | undefined> {
    return this.db.getById<Match>(STORES.MATCHES, id);
  }

  override async save(match: Match): Promise<Match> {
    return this.db.put<Match>(STORES.MATCHES, match);
  }

  override async delete(id: string): Promise<void> {
    return this.db.delete(STORES.MATCHES, id);
  }

  /**
   * O mesmo efeito da função do banco, feito à mão.
   *
   * Aqui não há RLS nem prazo para o banco guardar: o cenário é de memória, e
   * quem recusa fora do prazo é a store — que é o caminho comum aos dois.
   * `dissolvedTeamId` não faz nada porque a dupla do encaixe vive dentro do
   * objeto do campeonato, que a store grava inteiro logo em seguida.
   */
  override async correctScore(correction: ScoreCorrection): Promise<void> {
    const match = await this.getById(correction.matchId);
    if (!match) {
      throw new Error('Esta partida não existe mais');
    }

    const { scoreA, scoreB } = correction;
    await this.db.put<Match>(STORES.MATCHES, {
      ...match,
      scoreA,
      scoreB,
      winnerId: scoreA > scoreB ? match.teamAId : match.teamBId,
      loserId: scoreA > scoreB ? match.teamBId : match.teamAId,
      pointDifference: Math.abs(scoreA - scoreB),
      correctedAt: new Date().toISOString(),
    });

    for (const id of correction.obsoleteMatchIds) {
      await this.db.delete(STORES.MATCHES, id);
    }
  }
}
