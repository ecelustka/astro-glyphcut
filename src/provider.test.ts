import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { FontProvider } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { glyphcutCheck } from "./check.ts";
import type { FamilyOptions } from "./index.ts";
import { glyphcut } from "./provider.ts";

const REPO = new URL("../", import.meta.url);
const dirs: string[] = [];

async function tempRoot(): Promise<{ dir: string; root: URL }> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "glyphcut-provider-")));
  dirs.push(dir);
  // A real node_modules keeps the cache in the temp folder, not in the repo.
  await mkdir(join(dir, "node_modules"));
  for (const scope of ["@fontsource", "@fontsource-variable"]) {
    await symlink(
      await realpath(new URL(`node_modules/${scope}`, REPO)),
      join(dir, "node_modules", scope),
      "dir",
    );
  }
  return { dir, root: pathToFileURL(`${dir}/`) };
}

async function setup(text = {}): Promise<{
  dir: string;
  provider: FontProvider<FamilyOptions>;
}> {
  const { dir, root } = await tempRoot();
  const provider = glyphcut({ text });
  await provider.init?.({ root } as Parameters<NonNullable<typeof provider.init>>[0]);
  return { dir, provider };
}

function resolve(
  provider: FontProvider<FamilyOptions>,
  options: FamilyOptions,
  extra: { weights?: string[]; styles?: Array<"normal" | "italic"> } = {},
) {
  return provider.resolveFont({
    familyName: "Schibsted Grotesk",
    weights: extra.weights ?? ["400 800"],
    styles: extra.styles ?? ["normal", "italic"],
    subsets: ["latin"],
    formats: ["woff2"],
    options,
  });
}

let info: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let once: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // A real exit listener would set the exit code of the test worker.
  once = vi.spyOn(process, "once").mockImplementation(() => process);
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  // A config error sets the exit code. Do not let it fail the test run.
  process.exitCode = undefined;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("glyphcut provider", () => {
  it("has a name and keeps its options as config", () => {
    const provider = glyphcut({ text: { ascii: true } });
    expect(provider.name).toBe("glyphcut");
    expect(provider.config).toEqual({ text: { ascii: true } });
  });

  it("writes the subsets to cacheDir", async () => {
    const { dir, root } = await tempRoot();
    const custom = join(dir, "custom-cache");
    const provider = glyphcut({ text: {}, cacheDir: custom });
    await provider.init?.({ root } as Parameters<NonNullable<typeof provider.init>>[0]);
    const result = await resolve(provider, { fontsource: "schibsted-grotesk" });
    expect(result?.fonts.length).toBeGreaterThan(0);
    for (const font of result?.fonts ?? []) {
      expect(font.src[0]).toMatchObject({ url: expect.stringContaining(custom) });
    }
    expect(existsSync(join(dir, "node_modules/.astro/glyphcut"))).toBe(false);
  });

  it("returns one font for each style of a variable font", async () => {
    const { provider } = await setup({ ascii: true });
    const result = await resolve(provider, { fontsource: "schibsted-grotesk" });
    expect(result?.fonts).toHaveLength(2);
    expect(result?.fonts.map((font) => font.style)).toEqual(["normal", "italic"]);
    for (const font of result?.fonts ?? []) {
      expect(font.weight).toBe("400 800");
      expect(font.unicodeRange?.[0]).toMatch(/^U\+20-7E/);
      const src = font.src?.[0];
      expect(src).toMatchObject({ format: "woff2" });
      expect(existsSync((src as { url: string }).url)).toBe(true);
    }
  });

  it("logs a new subset once and nothing for a cached one", async () => {
    const { provider } = await setup({ ascii: true });
    await resolve(provider, { fontsource: "schibsted-grotesk" }, { styles: ["normal"] });
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toMatch(
      /^\[glyphcut\] schibsted-grotesk-normal: \d[\d ]* → \d[\d ]* B \(-\d+%\)$/,
    );
    info.mockClear();
    await resolve(provider, { fontsource: "schibsted-grotesk" }, { styles: ["normal"] });
    expect(info).not.toHaveBeenCalled();
  });

  it("warns about a glyph the font does not have", async () => {
    const { provider } = await setup({ ascii: true, extra: "Ω" });
    await resolve(provider, { fontsource: "schibsted-grotesk" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[glyphcut] schibsted-grotesk: no glyph for "Ω" (U+03A9)');
  });

  it("logs through the Astro logger from glyphcutCheck", async () => {
    const { provider } = await setup({ ascii: true, extra: "Ω" });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    await glyphcutCheck(provider).hooks["astro:config:setup"]!({ logger } as never);
    await resolve(provider, { fontsource: "schibsted-grotesk" }, { styles: ["normal"] });
    await resolve(provider, { fontsource: "schibsted-grotesk" }, { styles: ["normal"] });
    await resolve(provider, {});
    expect(logger.info.mock.calls).toEqual([
      [expect.stringMatching(/^schibsted-grotesk-normal: [\d ]+ → [\d ]+ B \(-\d+%\)$/)],
    ]);
    expect(logger.debug.mock.calls).toEqual([["schibsted-grotesk-normal: cached"]]);
    expect(logger.warn.mock.calls).toEqual([['schibsted-grotesk: no glyph for "Ω" (U+03A9)']]);
    expect(logger.error.mock.calls).toEqual([
      ["Font Schibsted Grotesk needs either fontsource or src."],
    ]);
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("warns about a missing glyph once per process", async () => {
    const { provider } = await setup({ ascii: true, extra: "Ω" });
    await resolve(provider, { fontsource: "schibsted-grotesk" }, { styles: ["normal"] });
    await resolve(provider, { fontsource: "schibsted-grotesk" }, { styles: ["normal"] });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("logs a config error once, returns no fonts and sets exit code 1", async () => {
    const { provider } = await setup({ ascii: true });
    await expect(resolve(provider, {})).resolves.toEqual({ fonts: [] });
    await expect(resolve(provider, {})).resolves.toEqual({ fonts: [] });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "[glyphcut] Font Schibsted Grotesk needs either fontsource or src.",
    );
    expect(process.exitCode).toBe(1);
  });

  it("adds an exit listener that keeps exit code 1 after process.exit(0)", async () => {
    const { provider } = await setup({ ascii: true });
    await resolve(provider, {});
    expect(once).toHaveBeenCalledWith("exit", expect.any(Function));
    const listener = once.mock.calls.find(
      (call: unknown[]) => call[0] === "exit",
    )?.[1] as () => void;
    for (const before of [0, undefined, 2]) {
      process.exitCode = before;
      listener();
      expect(process.exitCode).toBe(before === 2 ? 2 : 1);
    }
  });

  it("logs an unexpected error, sets exit code 1 and passes it on", async () => {
    const { provider } = await setup({ ascii: true });
    await expect(resolve(provider, { src: { normal: 42 as unknown as string } })).rejects.toThrow(
      TypeError,
    );
    expect(String(error.mock.calls[0]?.[0])).toMatch(/^\[glyphcut\] /);
    expect(process.exitCode).toBe(1);
  });

  it("collapses a variable font with one weight to that weight", async () => {
    const { provider } = await setup({ ascii: true });
    const result = await provider.resolveFont({
      familyName: "JetBrains Mono",
      weights: ["400"],
      styles: ["normal"],
      subsets: ["latin"],
      formats: ["woff2"],
      options: { fontsource: "jetbrains-mono" },
    });
    expect(result?.fonts[0]?.weight).toBe("400");
  });

  it("uses the weight of a static file from a src list", async () => {
    const { dir, provider } = await setup({ ascii: true });
    await mkdir(join(dir, "fonts"));
    const source = await realpath(
      new URL(
        "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2",
        REPO,
      ),
    );
    await symlink(source, join(dir, "fonts", "b.woff2"));
    const result = await resolve(
      provider,
      { src: [{ path: "fonts/b.woff2", weight: 700, style: "normal" }] },
      { weights: ["700"], styles: ["normal"] },
    );
    expect(result?.fonts[0]?.weight).toBe("700");
  });

  it("names a single local file by its one weight", async () => {
    const { dir, provider } = await setup({ ascii: true });
    await mkdir(join(dir, "fonts"));
    const source = await realpath(
      new URL(
        "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
        REPO,
      ),
    );
    await symlink(source, join(dir, "fonts", "a.woff2"));
    const one = await resolve(
      provider,
      { src: "fonts/a.woff2" },
      { weights: ["400"], styles: ["normal"] },
    );
    expect(one?.fonts[0]?.weight).toBe("400");
    await resolve(provider, { src: "fonts/a.woff2" }, { weights: ["400 700"], styles: ["normal"] });
    expect(String(error.mock.calls[0]?.[0])).toMatch(/src list/);
  });
});
