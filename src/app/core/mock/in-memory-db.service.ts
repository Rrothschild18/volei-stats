import { Injectable } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';

const STORAGE_KEY = 'volei-stats:mock-data';

/**
 * Substituto do IndexedDB para rodar o app local com o cenário de exemplo do
 * redesign. É registrado por `provideMockData()`; o caminho de produção segue
 * no IndexedDB até a migração para o Supabase (ticket 18).
 *
 * O que você faz testando sobrevive a um F5, porque o estado fica no
 * `sessionStorage` da aba. Ele é descartado quando a aba fecha ou quando o dia
 * vira — o cenário é montado com datas relativas a hoje, e a "sessão de hoje"
 * precisa continuar sendo hoje.
 */
@Injectable()
export class InMemoryDbService extends IndexedDbService {
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
      // Sem armazenamento, o mock segue só em memória.
    }
  }

  override async getDb(): Promise<IDBDatabase> {
    throw new Error('O mock de dados não abre IndexedDB');
  }

  override async getAll<T>(storeName: string): Promise<T[]> {
    return [...this.store(storeName).values()].map((item) => structuredClone(item) as T);
  }

  override async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const item = this.store(storeName).get(id);
    return item === undefined ? undefined : (structuredClone(item) as T);
  }

  override async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey,
  ): Promise<T[]> {
    const all = await this.getAll<Record<string, unknown>>(storeName);
    return all.filter((item) => item[indexName] === value) as T[];
  }

  override async put<T>(storeName: string, item: T): Promise<T> {
    this.store(storeName).set(this.keyOf(item), structuredClone(item));
    this.persist();
    return item;
  }

  override async delete(storeName: string, id: string): Promise<void> {
    this.store(storeName).delete(id);
    this.persist();
  }

  override async exportAll(): Promise<Record<string, unknown[]>> {
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
