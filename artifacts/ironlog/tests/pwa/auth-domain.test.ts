import { describe, expect, it } from "vitest";
import { resolveAuthDomain } from "@/services/authDomain";

describe("resolveAuthDomain", () => {
  it("uses the host when served from *.web.app", () => {
    expect(resolveAuthDomain("env.firebaseapp.com", "ironlog.web.app")).toBe(
      "ironlog.web.app",
    );
  });

  it("uses the host when served from *.firebaseapp.com", () => {
    expect(resolveAuthDomain("", "ironlog.firebaseapp.com")).toBe(
      "ironlog.firebaseapp.com",
    );
  });

  it("keeps the env value on localhost and custom domains", () => {
    expect(resolveAuthDomain("env.firebaseapp.com", "localhost")).toBe(
      "env.firebaseapp.com",
    );
    expect(resolveAuthDomain("env.firebaseapp.com", "evil-web.app.example.com")).toBe(
      "env.firebaseapp.com",
    );
  });

  it("keeps the env value when there is no hostname (native/SSR)", () => {
    expect(resolveAuthDomain("env.firebaseapp.com", undefined)).toBe(
      "env.firebaseapp.com",
    );
  });

  it("does not match a bare suffix without a subdomain label", () => {
    expect(resolveAuthDomain("env", "web.app")).toBe("env");
  });
});
