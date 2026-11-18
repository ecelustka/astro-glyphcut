import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { findSources, weightRange } from "./sources.ts";
import { GlyphcutError } from "./subset.ts";

const REPO = new URL("../../", import.meta.url);
const temps: string[] = [];

async function tempRoot(): Promise<{ dir: string; root: URL }> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "glyphcut-sources-")));
  temps.push(dir);
  return { dir, root: pathToFileURL(`${dir}/`) };
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function rejection(promise: Promise<unknown>): Promise<GlyphcutError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(GlyphcutError);
  return error as GlyphcutError;
}

describe("weightRange", () => {
  it("reads a range string", () => {
    expect(weightRange(["400 800"])).toEqual({ min: 400, max: 800 });
  });
  it("reads a list of strings", () => {
    expect(weightRange(["400", "700"])).toEqual({ min: 400, max: 700 });
  });
  it("reads a number", () => {
    expect(weightRange([400])).toEqual({ min: 400, max: 400 });
  });
  it("reads the normal and bold keywords", () => {
    expect(weightRange(["normal", "BOLD"])).toEqual({ min: 400, max: 700 });
    expect(weightRange(["Normal bold"])).toEqual({ min: 400, max: 700 });
  });
  it("rejects other keywords", () => {
    for (const weight of ["bolder", "lighter", "heavy"]) {
      expect(() => weightRange([weight])).toThrow(GlyphcutError);
      expect(() => weightRange([weight])).toThrow(`"${weight}"`);
    }
  });
});

describe("findSources with fontsource", () => {
  it("tells how to drop the italic style that a package does not have", async () => {
    const { dir, root } = await tempRoot();
    const pkg = join(dir, "node_modules", "@fontsource-variable", "upright");
    await mkdir(join(pkg, "files"), { recursive: true });
    await writeFile(join(pkg, "package.json"), "{}");
    await writeFile(join(pkg, "files", "upright-latin-wght-normal.woff2"), "x");
    const error = await rejection(
      findSources({
        root,
        family: "Upright",
        options: { fontsource: "upright" },
        weights: ["400"],
        styles: ["normal", "italic"],
      }),
    );
    expect(error.message).toContain('styles: ["normal"]');
  });

  it("finds the variable files", async () => {
    const files = await findSources({
      root: REPO,
      family: "Schibsted Grotesk",
      options: { fontsource: "schibsted-grotesk" },
      weights: ["400 800"],
      styles: ["normal", "italic"],
    });
    expect(files).toHaveLength(2);
    expect(files.every((file) => file.variable)).toBe(true);
    expect(files[0]?.path.endsWith("schibsted-grotesk-latin-wght-normal.woff2")).toBe(true);
    expect(files[1]?.path.endsWith("schibsted-grotesk-latin-wght-italic.woff2")).toBe(true);
  });

  it("falls back to the static package", async () => {
    const { dir, root } = await tempRoot();
    await mkdir(join(dir, "node_modules", "@fontsource"), { recursive: true });
    await symlink(
      await realpath(new URL("node_modules/@fontsource/jetbrains-mono", REPO)),
      join(dir, "node_modules", "@fontsource", "jetbrains-mono"),
    );
    const files = await findSources({
      root,
      family: "JetBrains Mono",
      options: { fontsource: "jetbrains-mono" },
      weights: ["400", "700"],
      styles: ["normal"],
    });
    expect(files.map((file) => file.weight)).toEqual([400, 700]);
    expect(files.every((file) => !file.variable)).toBe(true);
  });

  it("includes every static weight in a range", async () => {
    const { dir, root } = await tempRoot();
    await mkdir(join(dir, "node_modules", "@fontsource"), { recursive: true });
    await symlink(
      await realpath(new URL("node_modules/@fontsource/jetbrains-mono", REPO)),
      join(dir, "node_modules", "@fontsource", "jetbrains-mono"),
    );
    const files = await findSources({
      root,
      family: "JetBrains Mono",
      options: { fontsource: "jetbrains-mono" },
      weights: ["400 600"],
      styles: ["normal"],
    });
    expect(files.map((file) => file.weight)).toEqual([400, 500, 600]);
  });

  it("walks up from a nested root", async () => {
    const { dir } = await tempRoot();
    await mkdir(join(dir, "node_modules", "@fontsource-variable"), { recursive: true });
    await symlink(
      await realpath(new URL("node_modules/@fontsource-variable/schibsted-grotesk", REPO)),
      join(dir, "node_modules", "@fontsource-variable", "schibsted-grotesk"),
    );
    await mkdir(join(dir, "packages", "site"), { recursive: true });
    const files = await findSources({
      root: pathToFileURL(`${dir}/packages/site/`),
      family: "Schibsted Grotesk",
      options: { fontsource: "schibsted-grotesk" },
      weights: ["400 800"],
      styles: ["normal"],
    });
    expect(files).toHaveLength(1);
  });

  it("reports an unknown id", async () => {
    const { root } = await tempRoot();
    const error = await rejection(
      findSources({
        root,
        family: "Nope",
        options: { fontsource: "nope-font" },
        weights: ["400"],
        styles: ["normal"],
      }),
    );
    expect(error.message).toContain("nope-font");
    expect(error.message).toContain("pnpm add @fontsource-variable/nope-font");
  });

  it("reports a missing style", async () => {
    const error = await rejection(
      findSources({
        root: REPO,
        family: "JetBrains Mono",
        options: { fontsource: "jetbrains-mono" },
        weights: ["400 800"],
        styles: ["oblique"],
      }),
    );
    expect(error.message).toContain("oblique");
  });
});

describe("findSources with src", () => {
  const base = { family: "Local", weights: ["400"], styles: ["normal" as const] };

  it("picks the list entries that match the weights", async () => {
    const { dir, root } = await tempRoot();
    await writeFile(join(dir, "a.woff2"), "");
    await writeFile(join(dir, "b.woff2"), "");
    const files = await findSources({
      ...base,
      root,
      options: {
        src: [
          { path: "a.woff2", weight: 400, style: "normal" },
          { path: "b.woff2", weight: "700", style: "normal" },
        ],
      },
    });
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: join(dir, "a.woff2"), weight: 400, style: "normal" });
  });

  it("reads the normal and bold keywords in list entries", async () => {
    const { dir, root } = await tempRoot();
    await writeFile(join(dir, "a.woff2"), "");
    await writeFile(join(dir, "b.woff2"), "");
    const files = await findSources({
      ...base,
      root,
      weights: ["normal", "bold"],
      options: {
        src: [
          { path: "a.woff2", weight: "Normal", style: "normal" },
          { path: "b.woff2", weight: "bold", style: "normal" },
        ],
      },
    });
    expect(files.map((file) => file.weight)).toEqual([400, 700]);
  });

  it("rejects another keyword in a list entry", async () => {
    const { dir, root } = await tempRoot();
    await writeFile(join(dir, "a.woff2"), "");
    const error = await rejection(
      findSources({
        ...base,
        root,
        options: { src: [{ path: "a.woff2", weight: "bolder", style: "normal" }] },
      }),
    );
    expect(error.message).toContain('"bolder"');
  });

  it("resolves a string relative to the root", async () => {
    const { dir, root } = await tempRoot();
    await mkdir(join(dir, "fonts"));
    await writeFile(join(dir, "fonts", "a.woff2"), "");
    const files = await findSources({ ...base, root, options: { src: "fonts/a.woff2" } });
    expect(files.map((file) => file.path)).toEqual([join(dir, "fonts", "a.woff2")]);
  });

  it("resolves a style map relative to the root", async () => {
    const { dir, root } = await tempRoot();
    await writeFile(join(dir, "n.woff2"), "");
    await writeFile(join(dir, "i.woff2"), "");
    const files = await findSources({
      ...base,
      root,
      styles: ["normal", "italic"],
      options: { src: { normal: "n.woff2", italic: "i.woff2" } },
    });
    expect(files.map((file) => [file.style, file.path])).toEqual([
      ["normal", join(dir, "n.woff2")],
      ["italic", join(dir, "i.woff2")],
    ]);
  });

  it("reports a style the source does not have", async () => {
    const { dir, root } = await tempRoot();
    await writeFile(join(dir, "n.woff2"), "");
    const error = await rejection(
      findSources({ ...base, root, styles: ["italic"], options: { src: { normal: "n.woff2" } } }),
    );
    expect(error.message).toContain("italic");
  });

  it("reports a missing file with its absolute path", async () => {
    const { dir, root } = await tempRoot();
    const error = await rejection(findSources({ ...base, root, options: { src: "gone.woff2" } }));
    expect(error.message).toContain(join(dir, "gone.woff2"));
  });
});

describe("findSources option errors", () => {
  const base = { root: REPO, family: "X", weights: ["400"], styles: ["normal" as const] };

  it("rejects both fontsource and src", async () => {
    const error = await rejection(
      findSources({ ...base, options: { fontsource: "a", src: "a.woff2" } }),
    );
    expect(error.message).toContain("both");
  });

  it("rejects neither", async () => {
    const error = await rejection(findSources({ ...base, options: {} }));
    expect(error.message).toContain("fontsource");
    expect(error.message).toContain("src");
  });
});
