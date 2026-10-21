export const STORAGE_KEY = 'celebrateai:v1';

/**
 * Thin JSON wrapper around a Web Storage-compatible backend.
 * Methods never throw: storage can be unavailable (private mode, quota, disabled).
 */
export function createStorage(backend = globalThis.localStorage) {
  return {
    load() {
      try {
        const raw = backend?.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        backend.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        backend.removeItem(STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}
