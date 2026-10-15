/** Token persistence shared by the auth lifecycle and metadata provider. */
export interface AuthStorage {
  get(): string | null;
  set(token: string): void;
  remove(): void;
}

export interface BrowserTokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BrowserAuthStorageOptions {
  key?: string;
  /** Inject a browser-compatible storage, including in SSR/tests. */
  storage?: BrowserTokenStorage;
}

export function memoryAuthStorage(): AuthStorage {
  let token: string | null = null;
  return {
    get: () => token,
    set: (value) => {
      token = value;
    },
    remove: () => {
      token = null;
    },
  };
}

function browserAuthStorage(
  name: "localStorage" | "sessionStorage",
  { key = "@gasboost/auth", storage }: BrowserAuthStorageOptions,
): AuthStorage {
  // Browser globals are resolved only when the factory is called.
  const target = storage ?? globalThis[name];
  if (!target) {
    throw new Error(
      `${name} is not available. Provide storage or use memoryAuthStorage().`,
    );
  }
  return {
    get: () => target.getItem(key),
    set: (token) => target.setItem(key, token),
    remove: () => target.removeItem(key),
  };
}

export function localStorageAuthStorage(
  options: BrowserAuthStorageOptions = {},
): AuthStorage {
  return browserAuthStorage("localStorage", options);
}

export function sessionStorageAuthStorage(
  options: BrowserAuthStorageOptions = {},
): AuthStorage {
  return browserAuthStorage("sessionStorage", options);
}
