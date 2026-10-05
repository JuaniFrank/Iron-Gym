import { describe, expect, it } from "vitest";

import { errorDetail } from "@/utils/errorDetail";

const wrapped = (message: string, cause: unknown) => Object.assign(new Error(message), { cause });

describe("errorDetail", () => {
  it("shows the whole cause chain", () => {
    const err = wrapped("Failed to run the query 'insert into x'", new Error("UNIQUE constraint failed: routine_days.routine_id, routine_days.position"));
    expect(errorDetail(err)).toBe(
      "Failed to run the query 'insert into x' ← UNIQUE constraint failed: routine_days.routine_id, routine_days.position",
    );
  });

  it("truncates each long part so the alert stays readable", () => {
    const sqlText = `Failed to run the query 'insert into "routine_exercises" ${"(?, ".repeat(200)}'`;
    const detail = errorDetail(wrapped(sqlText, new Error("FOREIGN KEY constraint failed")));
    const [first, second] = detail.split(" ← ");
    expect(first.length).toBeLessThanOrEqual(161);
    expect(first.endsWith("…")).toBe(true);
    expect(second).toBe("FOREIGN KEY constraint failed");
  });

  it("falls back for empty errors", () => {
    expect(errorDetail(undefined)).toBe("Error desconocido");
    expect(errorDetail("boom")).toBe("boom");
  });
});
