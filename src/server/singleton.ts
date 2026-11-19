/**
 * One instance per Node process, even when this module is loaded twice. The custom server
 * (bundled by esbuild) and Next.js route handlers (bundled by Next) get separate copies of
 * every module, so module-level variables would not be shared; globalThis is.
 */
export function processSingleton<T>(name: string, init: () => T): T {
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  const key = Symbol.for(`storyforge.${name}`);
  return (store[key] ??= init());
}

/** Replaces or clears a process singleton (configuration at startup, tests). */
export function setProcessSingleton<T>(name: string, value: T | undefined): void {
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  store[Symbol.for(`storyforge.${name}`)] = value;
}

/** Reads a process singleton without creating it. */
export function peekProcessSingleton<T>(name: string): T | undefined {
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  return store[Symbol.for(`storyforge.${name}`)];
}
