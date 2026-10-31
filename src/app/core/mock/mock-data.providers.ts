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

/**
 * Roda o app contra o cenário de exemplo, sem IndexedDB e sem backend.
 *
 * O estado sobrevive a um F5 (fica no `sessionStorage` da aba) e volta ao
 * cenário inicial quando a aba fecha ou quando o dia vira.
 */
export function provideMockData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    InMemoryDbService,
    { provide: IndexedDbService, useExisting: InMemoryDbService },
    provideAppInitializer(() => {
      inject(InMemoryDbService).load(buildMockData(), todayDateString());
    }),
  ]);
}
