import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, test, vi } from "vitest";

import { cacheFileName, cacheKey, cachedSubset, cacheUrl } from "./cache.ts";
import { fontsourceFile } from "./fonts.test-utils.ts";
import type { SourceFile } from "./sources.ts";
import { GlyphcutError, subset } from "./subset.ts";
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

/** A cache file and sidecar from an earlier build, which this process did not return. */
async function staleFile(dir: URL, label: string): Promise<string> {
  const path = join(fileURLToPath(dir), `${label}-0123456789ab.woff2`);
  await writeFile(path, "x");
  await writeFile(`${path}.json`, "{}");
  return path;
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe("cacheUrl", () => {
  const root = pathToFileURL(`${tmpdir()}/`);

  test("defaults to node_modules/.astro/glyphcut", () => {
    expect(cacheUrl(root).href).toBe(new URL("node_modules/.astro/glyphcut/", root).href);
  });

  test("resolves a relative folder against the root, with one end slash", () => {
    const expected = new URL(".cache/fonts/", root).href;
    expect(cacheUrl(root, ".cache/fonts").href).toBe(expected);
    expect(cacheUrl(root, ".cache/fonts/").href).toBe(expected);
  });

  test("uses an absolute folder as is", () => {
    const other = join(tmpdir(), "glyphcut-abs");
    expect(cacheUrl(root, other).href).toBe(pathToFileURL(`${other}/`).href);
  });

  test("throws on an empty folder", () => {
    expect(() => cacheUrl(root, "")).toThrow(GlyphcutError);
    expect(() => cacheUrl(root, "")).toThrow("cacheDir must not be empty.");
  });
});

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

  test("a changed input makes a new file and deletes an old one from an earlier build", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" };
    const old = await staleFile(url, "schibsted-grotesk-normal");
    const second = await cachedSubset({ ...input, glyphs: "abcd" });
    expect(second.path).not.toBe(old);
    expect(await exists(second.path)).toBe(true);
    expect(await exists(old)).toBe(false);
    expect(await exists(`${old}.json`)).toBe(false);
  });

  test("keeps every file this process returned, also with the same family and style", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" };
    const light = await cachedSubset({ ...input, weight: { min: 300, max: 300 } });
    const bold = await cachedSubset({ ...input, weight: { min: 700, max: 700 } });
    expect(bold.path).not.toBe(light.path);
    expect(await exists(light.path)).toBe(true);
    expect(await exists(bold.path)).toBe(true);
  });

  test("keeps the files of entries that resolve at the same time", async () => {
    const { url, source } = await setup();
    const input = { dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" };
    const results = await Promise.all(
      [300, 400, 500, 600, 700].map((w) => cachedSubset({ ...input, weight: { min: w, max: w } })),
    );
    for (const { path } of results) expect(await exists(path)).toBe(true);
  });

  test("cleanup keeps other families", async () => {
    const { dir, url, source } = await setup();
    const other = await staleFile(url, "other-normal");
    await staleFile(url, "schibsted-grotesk-normal");
    await cachedSubset({ dir: url, family: "Schibsted Grotesk", source, glyphs: "abc" });
    expect(await exists(other)).toBe(true);
    expect((await readdir(dir)).filter((name) => name.endsWith(".woff2"))).toHaveLength(3);
  });

  test("cleanup keeps a family whose name starts with the same text", async () => {
    const { url, source } = await setup();
    const display = await staleFile(url, "inter-display-normal");
    await cachedSubset({ dir: url, family: "Inter", source, glyphs: "abc" });
    expect(await exists(display)).toBe(true);
  });

  test("cleanup removes leftover temp files of the same font", async () => {
    const { dir, url, source } = await setup();
    const old = await staleFile(url, "inter-normal");
    const leftovers = [`${old}.tmp-99999`, `${old}.tmp-99999-0123abcd`];
    const foreign = join(dir, "inter-display-normal-0123456789ab.woff2.tmp-1-0123abcd");
    for (const path of [...leftovers, foreign]) await writeFile(path, "x");
    await cachedSubset({ dir: url, family: "Inter", source, glyphs: "abc" });
    for (const path of leftovers) expect(await exists(path)).toBe(false);
    expect(await exists(foreign)).toBe(true);
  });

  test("cleanup keeps other weights and styles", async () => {
    const { url, source } = await setup();
    const w400 = await staleFile(url, "inter-normal-400");
    const italic = await staleFile(url, "inter-italic");
    await cachedSubset({ dir: url, family: "Inter", source, glyphs: "abc" });
    expect(await exists(w400)).toBe(true);
    expect(await exists(italic)).toBe(true);
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
