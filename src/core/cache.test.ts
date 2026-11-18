import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, test, vi } from "vitest";

import { cacheFileName, cacheKey, cachedSubset } from "./cache.ts";
import { fontsourceFile } from "./fonts.test-utils.ts";
import type { SourceFile } from "./sources.ts";
import { subset } from "./subset.ts";
import type * as SubsetModule from "./subset.ts";
import { engineVersions } from "./versions.ts";

vi.mock("./subset.ts", async (orig) => {
  const mod = await orig<typeof SubsetModule>();
  return { ...mod, subset: vi.fn(mod.subset) };
});

const file = "schibsted-grotesk-latin-wght-normal.woff2";
const pkg = "@fontsource-variable/schibsted-grotesk";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "glyphcut-cache-"));
  const url = pathToFileURL(`${dir}/`);
  const path = join(dir, "source.woff2");
  await writeFile(path, await fontsourceFile(pkg, file));
  const source: SourceFile = { path, style: "normal", variable: false };
  return { dir, url, source };
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe("cacheFileName", () => {
  test("uses the kebab case family, style, optional weight and key", () => {
    expect(cacheFileName("Schibsted Grotesk", "italic", undefined, "abc")).toBe(
      "schibsted-grotesk-italic-abc.woff2",
    );
    expect(cacheFileName("Schibsted Grotesk", "italic", 700, "abc")).toBe(
      "schibsted-grotesk-italic-700-abc.woff2",
    );
  });
});

describe("cacheKey", () => {
  const base = {
    source: new Uint8Array([1, 2, 3]),
    glyphs: "abc",
    versions: { harfbuzzjs: "1.0.0" },
  };

  test("is 12 hex characters", () => {
    expect(cacheKey(base)).toMatch(/^[0-9a-f]{12}$/);
  });

  test("a different engine version changes the key", () => {
    expect(cacheKey({ ...base, versions: { harfbuzzjs: "1.0.1" } })).not.toBe(cacheKey(base));
  });

  test("every input changes the key", () => {
    const key = cacheKey(base);
    expect(cacheKey({ ...base, glyphs: "abcd" })).not.toBe(key);
    expect(cacheKey({ ...base, source: new Uint8Array([1, 2, 4]) })).not.toBe(key);
    expect(cacheKey({ ...base, features: ["kern"] })).not.toBe(key);
    expect(cacheKey({ ...base, weight: { min: 400, max: 700 } })).not.toBe(key);
  });
});

describe("engineVersions", () => {
  test("reads the three installed versions", async () => {
    const versions = await engineVersions();
    for (const name of ["astro-glyphcut", "subset-font", "harfbuzzjs"]) {
      expect(versions[name]).toMatch(/^\d+\.\d+\.\d+/);
    }
  });
});

describe("cachedSubset", () => {
  test("second call uses the cache", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" };
    vi.mocked(subset).mockClear();
    const first = await cachedSubset(input);
    const second = await cachedSubset(input);
    expect(first.created).toBe(true);
    expect(first.sizes?.after).toBeGreaterThan(0);
    expect(second.created).toBe(false);
    expect(second.path).toBe(first.path);
    expect(second.sizes).toBeUndefined();
    expect(subset).toHaveBeenCalledTimes(1);
  });

  test("a changed input makes a new file and deletes the old one", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" };
    const first = await cachedSubset(input);
    const second = await cachedSubset({ ...input, glyphs: "abcd" });
    expect(second.path).not.toBe(first.path);
    expect(await exists(second.path)).toBe(true);
    expect(await exists(first.path)).toBe(false);
    expect(await exists(`${first.path}.json`)).toBe(false);
  });

  test("cleanup keeps other families", async () => {
    const { dir, url, source } = await setup();
    const a = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" };
    const b = { dir: url, family: "Other", source, glyphs: "abc" };
    const other = await cachedSubset(b);
    await cachedSubset(a);
    await cachedSubset({ ...a, glyphs: "abcd" });
    expect(await exists(other.path)).toBe(true);
    expect((await readdir(dir)).filter((name) => name.endsWith(".woff2"))).toHaveLength(3);
  });

  test("cleanup keeps a family whose name starts with the same text", async () => {
    const { url, source } = await setup();
    const display = await cachedSubset({
      dir: url,
      family: "Inter Display",
      source,
      glyphs: "abc",
    });
    const plain = { dir: url, family: "Inter", source, glyphs: "abc" };
    await cachedSubset(plain);
    await cachedSubset({ ...plain, glyphs: "abcd" });
    expect(await exists(display.path)).toBe(true);
  });

  test("cleanup removes leftover temp files of the same font", async () => {
    const { dir, url, source } = await setup();
    const input = { dir: url, family: "Inter", source, glyphs: "abc" };
    const first = await cachedSubset(input);
    const leftover = `${first.path}.tmp-99999`;
    const foreign = join(dir, "inter-display-normal-0123456789ab.woff2.tmp-1");
    await writeFile(leftover, "x");
    await writeFile(foreign, "x");
    await cachedSubset({ ...input, glyphs: "abcd" });
    expect(await exists(leftover)).toBe(false);
    expect(await exists(foreign)).toBe(true);
  });

  test("cleanup keeps other weights and styles", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Inter", source, glyphs: "abc" };
    const w400 = await cachedSubset({ ...input, source: { ...source, weight: 400 } });
    const italic = await cachedSubset({ ...input, source: { ...source, style: "italic" } });
    await cachedSubset({ ...input, glyphs: "abcd" });
    expect(await exists(w400.path)).toBe(true);
    expect(await exists(italic.path)).toBe(true);
  });

  test("missing glyphs and variable come back on a cache hit", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc中" };
    const first = await cachedSubset(input);
    const second = await cachedSubset(input);
    expect(first.missing).toEqual([0x4e2d]);
    expect(second.created).toBe(false);
    expect(second.missing).toEqual(first.missing);
    expect(first.variable).toBe(true);
    expect(second.variable).toBe(true);
  });
});
