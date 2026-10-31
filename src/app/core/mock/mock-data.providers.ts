import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { InMemoryDbService } from './in-memory-db.service';
import { buildMockData } from './mock-seed';
import { todayDateString } from '../../shared/utils/date.util';
import {
  DrawRepository,
  GroupRepository,
  MatchRepository,
  PlayerRepository,
  SessionRepository,
  StatsRepository,
  TournamentRepository,
} from '../repositories';
import {
  LocalDrawRepository,
  LocalGroupRepository,
  LocalMatchRepository,
  LocalPlayerRepository,
  LocalSessionRepository,
  LocalStatsRepository,
  LocalTournamentRepository,
} from '../repositories/local';
import { IdentityService, MembershipService } from '../identity';
import { DemoIdentityService } from '../identity/demo-identity.service';
import { DemoMembershipService } from '../identity/demo-membership.service';

/**
 * Modo demonstração: roda o app contra o cenário de exemplo, sem banco nenhum.
 *
 * Serve para mostrar o app sem rede e para os testes. O estado sobrevive a um
 * F5 (fica no `sessionStorage` da aba) e volta ao cenário inicial quando a aba
 * fecha ou quando o dia vira.
 */
export function provideDemoData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: GroupRepository, useClass: LocalGroupRepository },
    { provide: PlayerRepository, useClass: LocalPlayerRepository },
    { provide: SessionRepository, useClass: LocalSessionRepository },
    { provide: DrawRepository, useClass: LocalDrawRepository },
    { provide: TournamentRepository, useClass: LocalTournamentRepository },
    { provide: MatchRepository, useClass: LocalMatchRepository },
    { provide: StatsRepository, useClass: LocalStatsRepository },
    { provide: IdentityService, useClass: DemoIdentityService },
    { provide: MembershipService, useClass: DemoMembershipService },
    InMemoryDbService,
    { provide: IndexedDbService, useExisting: InMemoryDbService },
    provideAppInitializer(() => {
      inject(InMemoryDbService).load(buildMockData(), todayDateString());
    }),
  ]);
}
