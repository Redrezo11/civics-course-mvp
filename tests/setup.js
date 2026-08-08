// storage.js is a module singleton over localStorage, so tests must start from
// a clean slate or one test's progress leaks into the next.
//
// jsdom in this version does not provide a usable localStorage, so supply a
// minimal one. It must behave like the real thing for the cases storage.js
// relies on: getItem returns null when absent, setItem stringifies.
import { beforeEach } from 'vitest';

function memoryStorage() {
  let data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

if (typeof window.localStorage?.clear !== 'function') {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});
