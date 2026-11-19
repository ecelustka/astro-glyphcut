import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, expect, test, vi } from "vitest";

import { glyphcutCheck } from "./check.ts";
import type { CheckOptions } from "./check.ts";
import { GlyphcutError } from "./core/subset.ts";
import { glyphcut } from "./provider.ts";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function run(files: Record<string, string>, glyphs: string, options?: CheckOptions) {
  const dir = await mkdtemp(join(tmpdir(), "glyphcut-check-"));
  dirs.push(dir);
  for (const [name, html] of Object.entries(files)) {
    await mkdir(dirname(join(dir, name)), { recursive: true });
    await writeFile(join(dir, name), html);
  }
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fork: () => logger };
  const hook = glyphcutCheck(glyphcut({ text: { extra: glyphs } }), options).hooks[
    "astro:build:done"
  ]!;
  const done = hook({ dir: pathToFileURL(`${dir}/`), logger } as never);
  return { done, logger };
}

test("warns once for each missing character, with two pages at most", async () => {
  const { done, logger } = await run(
    {
      "index.html": "<p>ž</p>",
      "blog/a/index.html": "<p>ž</p>",
      "blog/b/index.html": "<p>ž</p>",
      "uses/index.html": "<p>ž</p>",
    },
    "abc ",
  );
  await done;
  expect(logger.warn.mock.calls).toEqual([
    ['"ž" (U+017E) is not in the glyph set: blog/a/index.html, blog/b/index.html and 2 more'],
  ]);
  expect(logger.info).not.toHaveBeenCalled();
});

test("logs one info line when all characters are in the glyph set", async () => {
  const { done, logger } = await run(
    { "index.html": "<p>ab</p>", "a/index.html": "<p>c</p>" },
    "abc",
  );
  await done;
  expect(logger.info.mock.calls).toEqual([["all characters of 2 pages are in the glyph set"]]);
  expect(logger.warn).not.toHaveBeenCalled();
});

test("passes an empty dir, also in strict mode", async () => {
  const { done, logger } = await run({}, "a", { strict: true });
  await done;
  expect(logger.info.mock.calls).toEqual([["all characters of 0 pages are in the glyph set"]]);
});

test("strict throws after the warnings", async () => {
  const { done, logger } = await run({ "index.html": "<p>ž©</p>" }, "", { strict: true });
  await expect(done).rejects.toThrow(
    new GlyphcutError("2 characters are not in the glyph set. See the warnings above."),
  );
  await expect(done).rejects.toBeInstanceOf(GlyphcutError);
  expect(logger.warn).toHaveBeenCalledTimes(2);
});

test("ignores files that are not HTML", async () => {
  const { done, logger } = await run({ "a.txt": "ž", "index.html": "<p>a</p>" }, "a", {
    strict: true,
  });
  await done;
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.info.mock.calls).toEqual([["all characters of 1 page are in the glyph set"]]);
});

test("is an integration named glyphcut", () => {
  const check = glyphcutCheck(glyphcut({ text: { ascii: true } }));
  expect(check.name).toBe("glyphcut");
  expect(check.hooks["astro:build:done"]).toBeTypeOf("function");
});

test("rejects a provider that glyphcut() did not make", () => {
  const other = { name: "other", resolveFont: async () => undefined };
  expect(() => glyphcutCheck(other)).toThrow(
    new GlyphcutError("glyphcutCheck needs a provider from glyphcut()."),
  );
});
