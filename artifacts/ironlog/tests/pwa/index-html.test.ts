import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  path.resolve(__dirname, "../../public/index.html"),
  "utf8",
);

describe("public/index.html mobile layout", () => {
  it("disables focus auto-zoom while keeping viewport-fit=cover", () => {
    const viewport = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1];
    expect(viewport).toBeDefined();
    expect(viewport).toContain("maximum-scale=1");
    expect(viewport).toContain("viewport-fit=cover");
  });

  it("paints html/body/#root so no white strip shows below the app", () => {
    expect(html).toMatch(/html,\s*body\s*{[^}]*background-color:/s);
    expect(html).toMatch(/#root\s*{[^}]*background-color:/s);
  });

  it("covers the full dynamic viewport (incl. home-indicator area)", () => {
    expect(html).toContain("100dvh");
    expect(html).toContain("-webkit-fill-available");
  });

  it("uses 100lvh in standalone PWAs (iOS subtracts the top inset from 100%/dvh)", () => {
    const standalone = html.match(
      /@media \(display-mode: standalone\)\s*{([\s\S]*?)\n\s{6}}/,
    );
    expect(standalone, "standalone media query").not.toBeNull();
    expect(standalone![1]).toMatch(/html,\s*body,\s*#root\s*{[^}]*height:\s*100lvh/s);
    expect(standalone![1]).toMatch(/min-height:\s*100lvh/);
  });

  it("guards against horizontal overflow", () => {
    expect(html).toMatch(/overflow-x:\s*hidden/);
  });
});
