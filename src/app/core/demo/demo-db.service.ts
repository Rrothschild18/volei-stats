import { Injectable } from '@angular/core';

const STORAGE_KEY = 'volei-stats:demo-data';

/** Os conjuntos do cenário de exemplo. */
export const STORES = {
  PLAYERS: 'players',
  SESSIONS: 'sessions',
  DRAWS: 'draws',
  TOURNAMENTS: 'tournaments',
  MATCHES: 'matches',
  GROUPS: 'groups',
  GROUP_MEMBERS: 'group_members',
} as const;

/**
 * O armazém do modo demonstração: mapas em memória.
 *
 * Isto já foi o banco do app, no IndexedDB. Não é mais: os dados moram no
 * Postgres, e o que sobrou aqui serve para mostrar o app sem rede e para os
 * testes. Ele não abre banco de navegador nenhum — a troca foi deliberada,
 * porque um banco local que não é a verdade só cria duas verdades.
 *
 * O que você faz demonstrando sobrevive a um F5, porque o estado fica no
 * `sessionStorage` da aba. Ele é descartado quando a aba fecha ou quando o dia
 * vira — o cenário é montado com datas relativas a hoje, e a "sessão de hoje"
 * precisa continuar sendo hoje.
 */
@Injectable()
export class DemoDbService {
  private readonly stores = new Map<string, Map<string, unknown>>();
  private day = '';

  /**
   * Carrega o conjunto inicial — ou o estado guardado na aba, se for do mesmo
   * dia. `day` é o carimbo que decide.
   */
  load(data: Readonly<Record<string, readonly unknown[]>>, day: string): void {
    this.day = day;

    const restored = this.restore(day);
    if (restored) {
      this.fill(restored);
      return;
    }

    this.fill(data);
    this.persist();
  }

  private fill(data: Readonly<Record<string, readonly unknown[]>>): void {
    this.stores.clear();
    for (const [storeName, items] of Object.entries(data)) {
      const store = new Map<string, unknown>();
      for (const item of items) {
        store.set(this.keyOf(item), structuredClone(item));
      }
      this.stores.set(storeName, store);
    }
  }

  private restore(day: string): Record<string, unknown[]> | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as { day: string; data: Record<string, unknown[]> };
      return parsed.day === day ? parsed.data : null;
    } catch {
      // Aba privada, armazenamento bloqueado ou dado corrompido: começa do zero.
      return null;
    }
  }

  private persist(): void {
    try {
      const data: Record<string, unknown[]> = {};
      for (const [storeName, store] of this.stores) {
        data[storeName] = [...store.values()];
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ day: this.day, data }));
    } catch {
      // Sem armazenamento, a demonstração segue só em memória.
    }
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return [...this.store(storeName).values()].map((item) => structuredClone(item) as T);
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const item = this.store(storeName).get(id);
    return item === undefined ? undefined : (structuredClone(item) as T);
  }

  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const all = await this.getAll<Record<string, unknown>>(storeName);
    return all.filter((item) => item[indexName] === value) as T[];
  }

  async put<T>(storeName: string, item: T): Promise<T> {
    this.store(storeName).set(this.keyOf(item), structuredClone(item));
    this.persist();
    return item;
  }

  async delete(storeName: string, id: string): Promise<void> {
    this.store(storeName).delete(id);
    this.persist();
  }

  async exportAll(): Promise<Record<string, unknown[]>> {
    const data: Record<string, unknown[]> = {};
    for (const [storeName, store] of this.stores) {
      data[storeName] = [...store.values()].map((item) => structuredClone(item));
    }
    return data;
  }

  private store(storeName: string): Map<string, unknown> {
    let store = this.stores.get(storeName);
    if (!store) {
      store = new Map<string, unknown>();
      this.stores.set(storeName, store);
    }
    return store;
  }

  private keyOf(item: unknown): string {
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string') {
      throw new Error('Todo registro precisa de um `id` string');
    }
    return id;
  }
}
