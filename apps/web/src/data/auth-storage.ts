export const authStorageKey = "bellefort-auth-session";
const migratedKey = "bellefort-auth-storage-v2";
const memory = new Map<string, string>();

/** Auth only. Preview records and synthetic drafts remain in sessionStorage. */
export const authStorage = {
  getItem(key: string): string | null {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
      // Never restore another tab's legacy credentials after a shared sign-out.
      if (localStorage.getItem(migratedKey)) {
        sessionStorage.removeItem(key);
        return null;
      }
      const legacy = sessionStorage.getItem(key);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.setItem(migratedKey, "1");
        sessionStorage.removeItem(key);
      }
      return legacy;
    } catch {
      try {
        return sessionStorage.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
      localStorage.setItem(migratedKey, "1");
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Storage is restricted. */
      }
      memory.delete(key);
    } catch {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      localStorage.setItem(migratedKey, "1");
      localStorage.removeItem(key);
    } catch {
      /* Restricted browsers use the tab fallback. */
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Memory fallback cleared. */
    }
  },
};
