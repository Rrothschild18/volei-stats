import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { DemoDbService } from './demo-db.service';
import { buildDemoData } from './demo-seed';
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
  DemoDrawRepository,
  DemoGroupRepository,
  DemoMatchRepository,
  DemoPlayerRepository,
  DemoSessionRepository,
  DemoStatsRepository,
  DemoTournamentRepository,
} from '../repositories/demo';
import { IdentityService, MembershipService } from '../identity';
import { DemoIdentityService } from './demo-identity.service';
import { DemoMembershipService } from './demo-membership.service';

/**
 * Modo demonstração: roda o app contra o cenário de exemplo, sem banco nenhum.
 *
 * Serve para mostrar o app sem rede e para os testes. O estado sobrevive a um
 * F5 (fica no `sessionStorage` da aba) e volta ao cenário inicial quando a aba
 * fecha ou quando o dia vira.
 */
export function provideDemoData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: GroupRepository, useClass: DemoGroupRepository },
    { provide: PlayerRepository, useClass: DemoPlayerRepository },
    { provide: SessionRepository, useClass: DemoSessionRepository },
    { provide: DrawRepository, useClass: DemoDrawRepository },
    { provide: TournamentRepository, useClass: DemoTournamentRepository },
    { provide: MatchRepository, useClass: DemoMatchRepository },
    { provide: StatsRepository, useClass: DemoStatsRepository },
    { provide: IdentityService, useClass: DemoIdentityService },
    { provide: MembershipService, useClass: DemoMembershipService },
    DemoDbService,
    provideAppInitializer(() => {
      inject(DemoDbService).load(buildDemoData(), todayDateString());
    }),
  ]);
}
