import { inject } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { Database } from '../../supabase/database.types';

export type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];

/**
 * O que todo repositório contra o banco precisa: o cliente, a garantia de que
 * existe sessão, e um jeito de transformar erro do Postgres em erro legível.
 *
 * A sessão é garantida aqui, e não em cada tela, porque as políticas do banco
 * só liberam para `authenticated`: sem ela, toda resposta seria um 401 que a
 * tela não saberia explicar.
 */
export abstract class SupabaseRepositoryBase {
  protected readonly supabase = inject(SupabaseService);

  protected async table<T extends keyof Tables & string>(name: T) {
    await this.supabase.ensureSession();
    return this.supabase.client.from(name);
  }

  protected async rpc() {
    await this.supabase.ensureSession();
    return this.supabase.client;
  }

  /** Erro do banco vira exceção; ausência de linha não é erro. */
  protected unwrap<T>(data: T | null, error: PostgrestError | null, what: string): T {
    if (error) {
      throw new Error(`${what}: ${error.message}`);
    }
    if (data === null) {
      throw new Error(`${what}: o banco não devolveu nada`);
    }
    return data;
  }
}
