import { expect, test } from "vitest";

import { glyphSet, unicodeRange } from "./text.ts";

test("ASCII is U+0020 to U+007E", () => {
  const glyphs = glyphSet({ ascii: true });
  expect(glyphs).toHaveLength(95);
  expect(glyphs.startsWith(" ")).toBe(true);
});

test("removes duplicates", () => {
  expect(glyphSet({ ascii: true, extra: "→→A" })).toHaveLength(96);
});

test("builds compact unicode ranges", () => {
  expect(unicodeRange(glyphSet({ ascii: true, extra: "\u00a0←↑→↓" }))).toEqual([
    "U+20-7E",
    "U+A0",
    "U+2190-2193",
  ]);
});
