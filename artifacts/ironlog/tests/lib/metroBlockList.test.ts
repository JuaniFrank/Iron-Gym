// Metro watches the workspace root (ironlog-port-minor-issues T12); tool
// folders in it that are rewritten constantly must not be watched (R8).

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { TOOL_DIR_BLOCK_PATTERNS, mergeBlockList } = require("../../metro.blocklist.js") as {
  TOOL_DIR_BLOCK_PATTERNS: RegExp[];
  mergeBlockList: (existing: unknown, extra: RegExp[]) => RegExp[];
};

const blocked = (list: RegExp[], file: string) => list.some((re) => re.test(file));

describe("TOOL_DIR_BLOCK_PATTERNS", () => {
  const list = TOOL_DIR_BLOCK_PATTERNS;

  it("blocks the codegraph index and the atl folder at any depth", () => {
    expect(blocked(list, "/repo/.codegraph/codegraph.db")).toBe(true);
    expect(blocked(list, "/repo/.codegraph/codegraph.db-wal")).toBe(true);
    expect(blocked(list, "/repo/.atl/skill-registry.md")).toBe(true);
    expect(blocked(list, "/repo/artifacts/ironlog/.atl/x.md")).toBe(true);
    expect(blocked(list, "/repo/.codegraph")).toBe(true);
    expect(blocked(list, "C:\\repo\\.codegraph\\codegraph.db")).toBe(true);
  });

  it("does not block source files or look-alike names", () => {
    expect(blocked(list, "/repo/artifacts/ironlog/app/index.tsx")).toBe(false);
    expect(blocked(list, "/repo/artifacts/ironlog/codegraph.ts")).toBe(false);
    expect(blocked(list, "/repo/artifacts/ironlog/.atlas/x.ts")).toBe(false);
    expect(blocked(list, "/repo/artifacts/ironlog/my.codegraph/x.ts")).toBe(false);
  });
});

describe("mergeBlockList", () => {
  const keep = /__tests__/;
  const extra = [/extra/];

  it("keeps the existing patterns of an array", () => {
    expect(mergeBlockList([keep], extra)).toEqual([keep, ...extra]);
  });

  it("keeps an existing single RegExp", () => {
    expect(mergeBlockList(keep, extra)).toEqual([keep, ...extra]);
  });

  it("handles no existing blockList", () => {
    expect(mergeBlockList(undefined, extra)).toEqual(extra);
  });

  it("does not duplicate a pattern already present", () => {
    expect(mergeBlockList([extra[0]], extra)).toEqual(extra);
  });
});
