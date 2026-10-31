import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { environment } from '../../environments/environment';
import { IdentityService, MembershipService } from './identity';
import { SupabaseIdentityService } from './identity/supabase-identity.service';
import { SupabaseMembershipService } from './identity/supabase-membership.service';
import { provideDemoData } from './mock/mock-data.providers';
import {
  DrawRepository,
  GroupRepository,
  MatchRepository,
  PlayerRepository,
  SessionRepository,
  StatsRepository,
  TournamentRepository,
} from './repositories';
import {
  SupabaseDrawRepository,
  SupabaseGroupRepository,
  SupabaseMatchRepository,
  SupabasePlayerRepository,
  SupabaseSessionRepository,
  SupabaseStatsRepository,
  SupabaseTournamentRepository,
} from './repositories/supabase';

/**
 * De onde o app lê e escreve. Uma escolha, feita uma vez.
 *
 * Nenhuma tela sabe qual das duas está valendo: as duas implementam os mesmos
 * contratos de `core/repositories`.
 */
export function provideData(): EnvironmentProviders {
  return environment.dataSource === 'demo' ? provideDemoData() : provideSupabaseData();
}

export function provideSupabaseData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: GroupRepository, useClass: SupabaseGroupRepository },
    { provide: PlayerRepository, useClass: SupabasePlayerRepository },
    { provide: SessionRepository, useClass: SupabaseSessionRepository },
    { provide: DrawRepository, useClass: SupabaseDrawRepository },
    { provide: TournamentRepository, useClass: SupabaseTournamentRepository },
    { provide: MatchRepository, useClass: SupabaseMatchRepository },
    { provide: StatsRepository, useClass: SupabaseStatsRepository },
    { provide: IdentityService, useClass: SupabaseIdentityService },
    { provide: MembershipService, useClass: SupabaseMembershipService },
  ]);
}
