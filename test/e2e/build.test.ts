import { readdir, readFile, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "astro";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const fixture = new URL("../fixtures/basic/", import.meta.url);
const dist = fileURLToPath(new URL("dist/", fixture));
let html = "";

// Known subset sizes. They can change with a Fontsource update.
const EXPECTED_SIZES = [23852, 28008, 30496];

async function sourceSizes(): Promise<number[]> {
  const pkgs = ["jetbrains-mono", "schibsted-grotesk"];
  const files = pkgs.flatMap((pkg) =>
    ["normal", "italic"].map(
      (style) =>
        new URL(
          `node_modules/@fontsource-variable/${pkg}/files/${pkg}-latin-wght-${style}.woff2`,
          fixture,
        ),
    ),
  );
  return Promise.all(files.map(async (f) => (await stat(f)).size));
}

beforeAll(async () => {
  await rm(dist, { recursive: true, force: true });
  await build({ root: fileURLToPath(fixture), logLevel: "error" });
  html = await readFile(`${dist}index.html`, "utf8");
});

describe("astro build with glyphcut", () => {
  it("emits four woff2 files", async () => {
    // Three for the page, and one for the second JetBrains Mono entry (same family and style).
    const files = await readdir(`${dist}_astro/fonts`);
    expect(files.filter((f) => f.endsWith(".woff2"))).toHaveLength(4);
  });

  it("limits the font-face rules to the subset range", () => {
    // One rule per font file: JetBrains Mono, Schibsted Grotesk normal and italic.
    const rules = html.match(/@font-face\s*{[^}]*unicode-range:\s*U\+20-7e[^}]*}/gi) ?? [];
    expect(rules).toHaveLength(3);
    // The extra characters are in the range as well.
    for (const rule of rules) expect(rule).toContain("U+2190-2193");
  });

  it("adds size-adjust to a fallback face", () => {
    const rules = html.match(/@font-face\s*{[^}]*size-adjust[^}]*}/gi) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toMatch(/font-family:\s*"[^"]*fallback/i);
  });

  it("preloads the three woff2 files", () => {
    expect(html.match(/<link rel="preload"[^>]*\.woff2/g)).toHaveLength(3);
  });

  it("subsets the fonts to the known sizes", async () => {
    const dir = `${dist}_astro/fonts`;
    const files = (await readdir(dir)).filter((f) => f.endsWith(".woff2"));
    const sizes = await Promise.all(files.map(async (f) => (await stat(`${dir}/${f}`)).size));
    for (const expected of EXPECTED_SIZES) {
      const close = sizes.filter((size) => Math.abs(size - expected) / expected < 0.02);
      expect(close.length, `a file near ${expected} B in ${sizes.join(", ")}`).toBeGreaterThan(0);
    }
    const smallestSource = Math.min(...(await sourceSizes()));
    for (const size of sizes) expect(size).toBeLessThan(smallestSource);
  });
});
