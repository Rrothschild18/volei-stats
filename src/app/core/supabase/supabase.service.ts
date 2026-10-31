import { Injectable } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { OFFLINE_MESSAGE } from '../../shared/utils/error.util';
import { Database } from './database.types';

/**
 * Teto para um pedido ao banco.
 *
 * Não é sobre impaciência: numa rede ruim de celular um socket fica aberto sem
 * resposta por minutos, e nesse tempo a tela mostra "Atualizando…" para sempre.
 * Com teto, a pessoa recebe uma resposta — mesmo que seja "sem conexão".
 */
const TIMEOUT_MS = 8000;

/**
 * Sem rede, nem tenta.
 *
 * `navigator.onLine === false` é confiável no sentido que importa: quando é
 * falso, não há rede. (O contrário não vale — estar "online" não garante que o
 * servidor responda, e é para isso que existe o teto acima.) Sem este atalho, o
 * modo avião levava uns dez segundos de tentativas e reentregas antes de a tela
 * poder dizer o que já se sabia.
 */
function fetchWithLimits(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new Error(OFFLINE_MESSAGE));
  }
  return fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

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
    {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { fetch: fetchWithLimits },
    },
  );

  /** Uma só promessa em voo: duas telas carregando juntas não abrem duas sessões. */
  #pending: Promise<Session> | null = null;

  async ensureSession(): Promise<Session> {
    // Sem rede, para aqui. Não é atalho de desempenho: pedir sessão offline faz
    // o cliente do Supabase tentar renovar o token com reentregas, e a tela fica
    // uns sete segundos dizendo "Atualizando…" antes de poder dizer o que já se
    // sabia no primeiro instante. Toda leitura precisa de rede de qualquer
    // forma, então não há nada a perder esperando.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(OFFLINE_MESSAGE);
    }

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
