import { Injectable } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Database } from './database.types';

/**
 * O cliente do Supabase, e a sessão anônima que é o modelo de acesso do app.
 *
 * Ninguém cria conta aqui: a primeira visita abre uma sessão anônima, e é ela
 * que o navegador guarda. Quem a pessoa é dentro de um vôlei é outra história —
 * isso ela diz com nome + data, e fica em `group_members`.
 *
 * Toda leitura e escrita passa por `ensureSession()` primeiro, porque as
 * políticas do banco só liberam para `authenticated`: sem sessão, a resposta
 * seria um 401 que a tela não sabe explicar.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    { auth: { persistSession: true, autoRefreshToken: true } },
  );

  /** Uma só promessa em voo: duas telas carregando juntas não abrem duas sessões. */
  #pending: Promise<Session> | null = null;

  async ensureSession(): Promise<Session> {
    const { data } = await this.client.auth.getSession();
    if (data.session) {
      return data.session;
    }

    this.#pending ??= this.#signInAnonymously();
    try {
      return await this.#pending;
    } finally {
      this.#pending = null;
    }
  }

  /** O id da sessão anônima deste navegador, se já existe uma. */
  async currentUserId(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async #signInAnonymously(): Promise<Session> {
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(error?.message ?? 'Não foi possível abrir uma sessão');
    }
    return data.session;
  }
}
