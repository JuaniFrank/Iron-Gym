import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = path.resolve(__dirname, "../../public");

function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  // PNG signature (8 bytes) + IHDR length/type (8 bytes) -> width/height.
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const manifest = JSON.parse(
  readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf8"),
);

describe("PWA manifest", () => {
  it("has the required installability fields", () => {
    expect(manifest.name).toBe("IronLog");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("declares 192, 512 and maskable 512 icons that exist with exact sizes", () => {
    const icons = manifest.icons as {
      src: string;
      sizes: string;
      type: string;
      purpose?: string;
    }[];
    const find = (sizes: string, purpose: string) =>
      icons.find(
        (i) => i.sizes === sizes && (i.purpose ?? "any") === purpose,
      );
    for (const [sizes, purpose] of [
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ] as const) {
      const icon = find(sizes, purpose);
      expect(icon, `${sizes} ${purpose}`).toBeDefined();
      expect(icon!.type).toBe("image/png");
      const file = path.join(publicDir, icon!.src.replace(/^\//, ""));
      expect(existsSync(file)).toBe(true);
      const [w] = sizes.split("x").map(Number);
      expect(pngSize(file)).toEqual({ width: w, height: w });
    }
  });

  it("ships a 180px apple touch icon", () => {
    const file = path.join(publicDir, "icons/apple-touch-icon.png");
    expect(pngSize(file)).toEqual({ width: 180, height: 180 });
  });

  it("html template wires manifest, meta tags and SW registration", () => {
    const html = readFileSync(path.join(publicDir, "index.html"), "utf8");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain("serviceWorker.register");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("%WEB_TITLE%");
    // Registration only for the production export, never the dev server.
    expect(html).toContain("/_expo/static/js/web/");
  });
});
