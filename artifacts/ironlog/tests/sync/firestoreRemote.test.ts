import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory model of the slice of `firebase/firestore` the adapter uses.
const h = vi.hoisted(() => {
  const state = {
    commits: [] as { path: string; data: Record<string, unknown> }[][],
    queries: [] as { path: string; constraints: unknown[] }[],
    pages: [] as { id: string; data: Record<string, unknown> }[][],
  };
  return { state, SERVER_TS: { __sentinel: "serverTimestamp" } };
});

vi.mock("firebase/firestore", () => {
  class Timestamp {
    constructor(private ms: number) {}
    static fromMillis(ms: number) {
      return new Timestamp(ms);
    }
    toMillis() {
      return this.ms;
    }
  }
  return {
    Timestamp,
    serverTimestamp: () => h.SERVER_TS,
    doc: (_fs: unknown, ...segs: string[]) => ({ path: segs.join("/") }),
    collection: (_fs: unknown, ...segs: string[]) => ({
      path: segs.join("/"),
    }),
    writeBatch: () => {
      const ops: { path: string; data: Record<string, unknown> }[] = [];
      return {
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          ops.push({ path: ref.path, data });
        },
        commit: async () => {
          h.state.commits.push(ops);
        },
      };
    },
    where: (field: string, op: string, value: unknown) => ({
      kind: "where",
      field,
      op,
      value,
    }),
    orderBy: (field: string) => ({ kind: "orderBy", field }),
    limit: (n: number) => ({ kind: "limit", n }),
    startAfter: (snap: unknown) => ({ kind: "startAfter", snap }),
    query: (ref: { path: string }, ...constraints: unknown[]) => ({
      path: ref.path,
      constraints,
    }),
    getDocs: async (q: { path: string; constraints: unknown[] }) => {
      h.state.queries.push(q);
      const page = h.state.pages.shift() ?? [];
      return {
        docs: page.map((d) => ({ id: d.id, data: () => d.data })),
      };
    },
  };
});

import { Timestamp } from "firebase/firestore";
import { createFirestoreRemote } from "@/services/sync/firestoreRemote";
import type { RemoteChange } from "@/services/sync/remote";

const fs = {} as never;
const remote = createFirestoreRemote(fs);

function change(over: Partial<RemoteChange> = {}): RemoteChange {
  return {
    table: "body_weights",
    rowId: "w1",
    updatedAt: 1000,
    deleted: false,
    data: { id: "w1", weight: 80 },
    ...over,
  };
}

function remoteDoc(id: string, serverMs: number | null, over = {}) {
  return {
    id,
    data: {
      data: { id },
      updatedAt: 5,
      deleted: false,
      serverUpdatedAt: serverMs === null ? null : Timestamp.fromMillis(serverMs),
      ...over,
    },
  };
}

beforeEach(() => {
  h.state.commits = [];
  h.state.queries = [];
  h.state.pages = [];
});

describe("firestoreRemote.push", () => {
  it("writes users/{uid}/{table}/{rowId} with exactly the four fields", async () => {
    await remote.push("u1", [change()]);
    expect(h.state.commits).toHaveLength(1);
    expect(h.state.commits[0]).toEqual([
      {
        path: "users/u1/body_weights/w1",
        data: {
          data: { id: "w1", weight: 80 },
          updatedAt: 1000,
          deleted: false,
          serverUpdatedAt: h.SERVER_TS,
        },
      },
    ]);
  });

  it("writes tombstones with data null", async () => {
    await remote.push(
      "u1",
      [change({ deleted: true, data: null, updatedAt: 2000 })],
    );
    expect(h.state.commits[0][0].data).toEqual({
      data: null,
      updatedAt: 2000,
      deleted: true,
      serverUpdatedAt: h.SERVER_TS,
    });
  });

  it("chunks commits at 500 operations", async () => {
    const changes = Array.from({ length: 1201 }, (_, i) =>
      change({ rowId: `w${i}` }),
    );
    await remote.push("u1", changes);
    expect(h.state.commits.map((c) => c.length)).toEqual([500, 500, 201]);
  });

  it("does nothing for an empty list", async () => {
    await remote.push("u1", []);
    expect(h.state.commits).toHaveLength(0);
  });

  it.each([
    ["unknown table", change({ table: "key_value" })],
    ["empty rowId", change({ rowId: "" })],
    ["rowId with slash", change({ rowId: "a/b" })],
  ])("rejects %s before any write", async (_n, bad) => {
    await expect(remote.push("u1", [change(), bad])).rejects.toThrow();
    expect(h.state.commits).toHaveLength(0);
  });

  it("accepts every registered syncable table", async () => {
    const { SYNC_TABLES } = await import("@/services/sync/tables");
    await remote.push(
      "u1",
      SYNC_TABLES.map((t) => change({ table: t.name })),
    );
    expect(h.state.commits[0]).toHaveLength(SYNC_TABLES.length);
  });
});

describe("firestoreRemote.pullSince", () => {
  it("queries the table collection with a Timestamp cursor, ordered and limited", async () => {
    h.state.pages = [[]];
    await remote.pullSince("u1", "body_weights", 1234);
    const q = h.state.queries[0] as {
      path: string;
      constraints: Record<string, unknown>[];
    };
    expect(q.path).toBe("users/u1/body_weights");
    expect(q.constraints[0]).toMatchObject({
      kind: "where",
      field: "serverUpdatedAt",
      op: ">",
    });
    const cursor = q.constraints[0].value as Timestamp;
    expect(cursor).toBeInstanceOf(Timestamp);
    expect(cursor.toMillis()).toBe(1234);
    expect(q.constraints[1]).toEqual({
      kind: "orderBy",
      field: "serverUpdatedAt",
    });
    expect(q.constraints[2]).toEqual({ kind: "limit", n: 500 });
  });

  it("maps documents to PulledChange", async () => {
    h.state.pages = [
      [
        remoteDoc("a", 10, { data: { id: "a", x: 1 }, updatedAt: 7 }),
        remoteDoc("b", 20, { data: null, deleted: true }),
      ],
    ];
    const { changes } = await remote.pullSince("u1", "body_weights", 0);
    expect(changes).toEqual([
      {
        table: "body_weights",
        rowId: "a",
        updatedAt: 7,
        deleted: false,
        data: { id: "a", x: 1 },
        serverUpdatedAt: 10,
      },
      {
        table: "body_weights",
        rowId: "b",
        updatedAt: 5,
        deleted: true,
        data: null,
        serverUpdatedAt: 20,
      },
    ]);
  });

  it("paginates with startAfter(lastDoc) until a short page", async () => {
    const full = Array.from({ length: 500 }, (_, i) =>
      remoteDoc(`r${i}`, i + 1),
    );
    h.state.pages = [full, [remoteDoc("last", 501)]];
    const { changes } = await remote.pullSince("u1", "body_weights", 0);
    expect(changes).toHaveLength(501);
    expect(h.state.queries).toHaveLength(2);
    const second = h.state.queries[1].constraints as {
      kind: string;
      snap?: { id: string };
    }[];
    const sa = second.find((c) => c.kind === "startAfter");
    expect(sa?.snap?.id).toBe("r499");
  });

  it("stops after an exactly-full page followed by an empty one", async () => {
    const full = Array.from({ length: 500 }, (_, i) =>
      remoteDoc(`r${i}`, i + 1),
    );
    h.state.pages = [full, []];
    const { changes } = await remote.pullSince("u1", "body_weights", 0);
    expect(changes).toHaveLength(500);
    expect(h.state.queries).toHaveLength(2);
  });

  it("skips documents whose serverUpdatedAt is not yet a Timestamp", async () => {
    h.state.pages = [[remoteDoc("pending", null), remoteDoc("ok", 30)]];
    const { changes } = await remote.pullSince("u1", "body_weights", 0);
    expect(changes.map((c) => c.rowId)).toEqual(["ok"]);
  });

  it("rejects an unknown table without querying", async () => {
    await expect(remote.pullSince("u1", "key_value", 0)).rejects.toThrow();
    expect(h.state.queries).toHaveLength(0);
  });
});
