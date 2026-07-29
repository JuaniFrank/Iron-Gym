// Vitest stub for `expo-file-system`. Tests that exercise the photo
// pipeline replace this with `vi.mock` to assert FS interactions; this
// module just lets the import resolve when nothing has overridden it.

export class Directory {
  constructor(public readonly base: unknown, public readonly name: string) {}
  get exists(): boolean {
    return true;
  }
  create(_opts?: { intermediates?: boolean; idempotent?: boolean }): void {}
}

export class File {
  constructor(public readonly _refOrUri: unknown, public readonly _name?: string) {}
  get uri(): string {
    if (typeof this._refOrUri === "string") return this._refOrUri;
    return `file:///stub/${this._name ?? "x"}`;
  }
  get exists(): boolean {
    return true;
  }
  copy(_dst: File): void {}
  delete(): void {}
}

export const Paths = {
  document: { uri: "file:///stub-document/" },
};
