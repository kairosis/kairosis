import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  workspaceId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

export class TenantContext {
  static run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  }

  static getWorkspaceId(): string {
    const store = storage.getStore();
    if (!store) throw new Error('TenantContext is not set — call TenantContext.run() at the request/poller boundary');
    return store.workspaceId;
  }

  static getStore(): TenantStore | undefined {
    return storage.getStore();
  }
}
