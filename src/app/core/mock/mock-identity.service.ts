import { Injectable, signal } from '@angular/core';
import { MOCK_USER_PLAYER_ID } from './mock-seed';

const STORAGE_KEY = 'volei-stats:mock-identity';

/**
 * Quem está usando o app enquanto não existe autenticação.
 *
 * O ticket 20 troca isto pelo `auth.uid()` do Supabase. Até lá, dá para entrar
 * como qualquer jogador do cenário — é assim que se vê a tela do dono e a de
 * quem só joga, sem backend.
 */
@Injectable({ providedIn: 'root' })
export class MockIdentityService {
  private readonly stored = this.read();
  readonly playerId = signal(this.stored ?? MOCK_USER_PLAYER_ID);

  setPlayerId(playerId: string): void {
    this.playerId.set(playerId);
    try {
      localStorage.setItem(STORAGE_KEY, playerId);
    } catch {
      // Aba privada ou armazenamento bloqueado: segue só em memória.
    }
  }

  private read(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
