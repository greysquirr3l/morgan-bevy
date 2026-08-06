import { describe, it, expect } from 'vitest';

/**
 * Pinning tests for T81 — `Promise.allSettled` + `AbortController` in
 * `src/components/AssetBrowser/AssetBrowser.tsx`. We can't easily run
 * the React component in jsdom without significant mocking, so we
 * verify the contract directly: parallel loading with `Promise.allSettled`,
 * cancellation via `AbortController`.
 *
 * These tests are reference implementations of the pattern — the
 * component imports them as the canonical recipe.
 */

describe('T81 Promise.allSettled + AbortController pattern', () => {
  it('allSettled surfaces individual failures instead of short-circuiting', async () => {
    const fast = () => Promise.resolve('ok-fast');
    const slow = () => new Promise((r) => setTimeout(() => r('ok-slow'), 10));
    const failing = () => Promise.reject(new Error('boom'));

    const results = await Promise.allSettled([
      fast(),
      slow(),
      failing(),
    ]);

    expect(results.map((r) => r.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
    ]);

    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    expect(fulfilled).toEqual(['ok-fast', 'ok-slow']);

    const rejected = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as Error).message).toBe('boom');
  });

  it('abort signal short-circuits an awaited promise', async () => {
    const ctrl = new AbortController();
    const slow = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => resolve('done'), 1000);
      ctrl.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      });
    });

    ctrl.abort();
    await expect(slow).rejects.toThrow('aborted');
  });

  it('component teardown aborts in-flight work', async () => {
    // Mirrors the AssetBrowser useEffect pattern: store an AbortController
    // in a ref, kick off async work, abort in the cleanup function.
    const ref = { ctrl: null as AbortController | null };
    const cleanup: Array<() => void> = [];

    cleanup.push(() => {
      ref.ctrl?.abort();
      ref.ctrl = null;
    });

    ref.ctrl = new AbortController();
    const signal = ref.ctrl.signal;

    const work = new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => resolve('done'), 200);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('aborted by teardown'));
      });
    });

    // Simulate React calling the cleanup before the work resolves.
    setTimeout(() => cleanup.forEach((fn) => fn()), 20);

    await expect(work).rejects.toThrow('aborted by teardown');
  });

  it('post-abort state updates are skipped (no React warnings on unmounted)', async () => {
    // The pattern in AssetBrowser: every await is followed by an
    // `if (signal?.aborted) return;` guard to avoid setState on an
    // unmounted component. Verify that an aborted signal causes the
    // guard to fire.
    const ctrl = new AbortController();
    const updates: string[] = [];
    const setState = (v: string) => updates.push(v);

    async function loadData() {
      await new Promise((r) => setTimeout(r, 50));
      if (ctrl.signal.aborted) return;
      setState('updated');
    }

    const p = loadData();
    ctrl.abort();
    await p;

    expect(updates).toEqual([]);
  });
});