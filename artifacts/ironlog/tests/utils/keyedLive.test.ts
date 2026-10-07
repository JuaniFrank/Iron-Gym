import { describe, expect, it } from "vitest";

import {
  applyKeyedResult,
  selectKeyed,
  startKeyedLiveQuery,
  type KeyedResult,
} from "@/utils/keyedLive";

describe("selectKeyed", () => {
  it("is not loaded before any result", () => {
    expect(selectKeyed(undefined, "a")).toEqual({ data: undefined, loaded: false });
  });

  it("returns the data of the current key", () => {
    expect(selectKeyed({ key: "a", data: [1] }, "a")).toEqual({
      data: [1],
      loaded: true,
    });
  });

  it("hides the data of a previous key (key change -> not loaded)", () => {
    expect(selectKeyed({ key: "a", data: [1] }, "b")).toEqual({
      data: undefined,
      loaded: false,
    });
  });

  it("an empty result for the current key is loaded (empty != loading)", () => {
    expect(selectKeyed({ key: "a", data: [] as number[] }, "a")).toEqual({
      data: [],
      loaded: true,
    });
  });
});

describe("applyKeyedResult", () => {
  it("replaces the data on a reload of the same key", () => {
    const s = applyKeyedResult({ key: "a", data: [1] }, { key: "a", data: [2] });
    expect(s).toEqual({ key: "a", data: [2] });
  });

  it("adopts the result of a new key", () => {
    const s = applyKeyedResult({ key: "a", data: [1] }, { key: "b", data: [] });
    expect(s).toEqual({ key: "b", data: [] });
  });
});

/** A manually resolvable load + a manually triggerable change listener. */
function harness<K>(key: K) {
  const pending: Array<{
    resolve: (v: number[]) => void;
    reject: (e: unknown) => void;
  }> = [];
  const listeners = new Set<() => void>();
  const results: Array<KeyedResult<K, number[]>> = [];
  const errors: unknown[] = [];
  const stop = startKeyedLiveQuery<K, number[]>({
    key,
    load: () =>
      new Promise<number[]>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    subscribe: (onChange) => {
      listeners.add(onChange);
      return { remove: () => listeners.delete(onChange) };
    },
    onResult: (r) => results.push(r),
    onError: (e) => errors.push(e),
  });
  return { pending, listeners, results, errors, stop };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("startKeyedLiveQuery", () => {
  it("loads once on start and reports the result tagged with the key", async () => {
    const h = harness("s1");
    expect(h.pending).toHaveLength(1);
    h.pending[0].resolve([1]);
    await flush();
    expect(h.results).toEqual([{ key: "s1", data: [1] }]);
  });

  it("reloads on a database change and reports every result", async () => {
    const h = harness("s1");
    h.pending[0].resolve([1]);
    await flush();
    [...h.listeners][0]();
    expect(h.pending).toHaveLength(2);
    h.pending[1].resolve([1, 2]);
    await flush();
    expect(h.results).toEqual([
      { key: "s1", data: [1] },
      { key: "s1", data: [1, 2] },
    ]);
  });

  it("ignores a result that resolves after cleanup (stale key)", async () => {
    const h = harness("old");
    h.stop();
    h.pending[0].resolve([9]);
    await flush();
    expect(h.results).toEqual([]);
  });

  it("removes its change listener on cleanup and ignores later changes", () => {
    const h = harness("old");
    const [listener] = [...h.listeners];
    h.stop();
    expect(h.listeners.size).toBe(0);
    listener();
    expect(h.pending).toHaveLength(1);
  });

  it("late stale result after the new key was adopted never overwrites it", async () => {
    // Cold open: key "" starts (slow), then the session arrives and key "s1"
    // is adopted; the "" read resolves AFTER the "s1" one.
    let state: KeyedResult<string, number[]> | undefined;
    const apply = (r: KeyedResult<string, number[]>) => {
      state = applyKeyedResult(state, r);
    };
    const mk = (key: string) => {
      const pending: Array<(v: number[]) => void> = [];
      const stop = startKeyedLiveQuery<string, number[]>({
        key,
        load: () => new Promise<number[]>((res) => pending.push(res)),
        subscribe: () => ({ remove() {} }),
        onResult: apply,
        onError: () => {},
      });
      return { pending, stop };
    };
    const first = mk("");
    first.stop(); // key changed -> effect cleanup
    const second = mk("s1");
    second.pending[0]([7]);
    await flush();
    first.pending[0]([]); // stale, resolves late
    await flush();
    expect(selectKeyed(state, "s1")).toEqual({ data: [7], loaded: true });
  });

  it("a stale result does not make the new key look loaded", async () => {
    let state: KeyedResult<string, number[]> | undefined;
    const first = harness("");
    first.pending[0].resolve([]);
    await flush();
    state = first.results[0];
    // key switches to s1: the old entry must not satisfy it
    expect(selectKeyed(state, "s1").loaded).toBe(false);
  });

  it("drops an older read that lands after a newer one for the same key", async () => {
    const h = harness("s1");
    [...h.listeners][0](); // second read starts while the first is in flight
    h.pending[1].resolve([2]); // newer lands first
    await flush();
    h.pending[0].resolve([1]); // older lands late
    await flush();
    expect(h.results).toEqual([{ key: "s1", data: [2] }]);
  });

  it("reports a load failure without reporting a result", async () => {
    const h = harness("s1");
    h.pending[0].reject(new Error("boom"));
    await flush();
    expect(h.results).toEqual([]);
    expect(h.errors).toHaveLength(1);
  });

  it("does not report an error that arrives after cleanup", async () => {
    const h = harness("s1");
    h.stop();
    h.pending[0].reject(new Error("boom"));
    await flush();
    expect(h.errors).toEqual([]);
  });
});
