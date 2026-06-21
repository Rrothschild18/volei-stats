import { Injectable } from '@angular/core';
import { DB_NAME, DB_VERSION, STORES } from './database.config';

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private db: IDBDatabase | null = null;

  async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.openDb();
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.PLAYERS)) {
          const playerStore = db.createObjectStore(STORES.PLAYERS, { keyPath: 'id' });
          playerStore.createIndex('active', 'active', { unique: false });
          playerStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.DRAWS)) {
          const drawStore = db.createObjectStore(STORES.DRAWS, { keyPath: 'id' });
          drawStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.TOURNAMENTS)) {
          const tournamentStore = db.createObjectStore(STORES.TOURNAMENTS, { keyPath: 'id' });
          tournamentStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.MATCHES)) {
          const matchStore = db.createObjectStore(STORES.MATCHES, { keyPath: 'id' });
          matchStore.createIndex('tournamentId', 'tournamentId', { unique: false });
          matchStore.createIndex('sessionId', 'sessionId', { unique: false });
          matchStore.createIndex('playedAt', 'playedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, item: T): Promise<T> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportAll(): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {};
    for (const storeName of Object.values(STORES)) {
      result[storeName] = await this.getAll(storeName);
    }
    return result;
  }
}
