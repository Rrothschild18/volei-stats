import { Injectable, inject } from '@angular/core';
import { PlayerStats, TeamStats } from '../../../shared/models';
import { AppFacade } from '../../facade/app.facade';
import { StatisticsService } from '../../services/statistics.service';
import { StatsRepository } from '../repository.contracts';

/**
 * No modo demonstração quem soma é o navegador, pelo mesmo serviço que monta o
 * perfil de cada jogador. Os números são os mesmos que as views dão; o que muda
 * é onde a soma acontece.
 */
@Injectable()
export class LocalStatsRepository extends StatsRepository {
  private readonly statistics = inject(StatisticsService);
  private readonly facade = inject(AppFacade);

  override async playerStats(groupId: string): Promise<readonly PlayerStats[]> {
    const scope = await this.facade.getGroupScope(groupId);
    return this.statistics.getAllPlayerStats({ scope, includeWithoutGames: true });
  }

  override async teamStats(groupId: string): Promise<readonly TeamStats[]> {
    const scope = await this.facade.getGroupScope(groupId);
    return this.statistics.getTeamStats(scope);
  }
}
