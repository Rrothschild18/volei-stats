import { Injectable, inject } from '@angular/core';
import { GroupRole } from '../../shared/models';
import { SupabaseService } from '../supabase/supabase.service';
import { IdentityService, MyGroup } from './identity.service';

/**
 * Quem este navegador é, segundo o banco.
 *
 * Não há login: a sessão anônima é a identidade do aparelho, e o que ela
 * significa em cada vôlei está em `group_members` — foi `claim_player` que
 * escreveu lá, comparando nome e data dentro do servidor.
 */
@Injectable()
export class SupabaseIdentityService implements IdentityService {
  private readonly supabase = inject(SupabaseService);

  async myGroups(): Promise<readonly MyGroup[]> {
    await this.supabase.ensureSession();
    const { data, error } = await this.supabase.client
      .from('my_groups')
      .select(
        'id, name, role, player_id, is_owner, today_session_id, player_count, last_session_date',
      )
      .order('name');

    if (error) {
      throw new Error(`Não foi possível ler os seus vôleis: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      groupId: row.id ?? '',
      name: row.name ?? '',
      role: (row.role ?? 'viewer') as GroupRole,
      playerId: row.player_id,
      isOwner: row.is_owner ?? false,
      todaySessionId: row.today_session_id,
      playerCount: row.player_count ?? 0,
      lastSessionDate: row.last_session_date,
    }));
  }

  async myGroup(groupId: string): Promise<MyGroup | null> {
    const groups = await this.myGroups();
    return groups.find((group) => group.groupId === groupId) ?? null;
  }

  async forget(): Promise<void> {
    await this.supabase.signOut();
  }
}
