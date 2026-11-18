import { describe, expect, test } from "vitest";

import { fontsourceFile, SITE_EXTRA } from "./fonts.test-utils.ts";
import { inspectFont } from "./inspect.ts";
import { GlyphcutError, subset } from "./subset.ts";
import { glyphSet } from "./text.ts";

const schibsted = () =>
  fontsourceFile(
    "@fontsource-variable/schibsted-grotesk",
    "schibsted-grotesk-latin-wght-normal.woff2",
  );
const glyphs = glyphSet({ ascii: true, extra: SITE_EXTRA });

describe("subset", () => {
  test("keeps exactly the requested characters the source has", async () => {
    const data = await schibsted();
    const source = await inspectFont(data);
    const out = await subset({ data, glyphs });
    const info = await inspectFont(out.data);
    const expected = Array.from(glyphs)
      .map((c) => c.codePointAt(0)!)
      .filter((c) => source.codepoints.has(c));
    expect([...info.codepoints].sort((a, b) => a - b)).toEqual(expected);
  });

  test("keeps only the selected features", async () => {
    const features = ["ccmp", "kern", "liga", "locl", "mark", "mkmk", "tnum"];
    const out = await subset({ data: await schibsted(), glyphs, features });
    const info = await inspectFont(out.data);
    expect(info.features.size).toBeGreaterThan(0);
    for (const tag of info.features) expect(features).toContain(tag);
  });

  test("clamps the wght axis", async () => {
    const out = await subset({
      data: await schibsted(),
      glyphs,
      weight: { min: 400, max: 800 },
    });
    const info = await inspectFont(out.data);
    expect(info.axes.wght).toMatchObject({ min: 400, max: 800 });
  });

  test("rejects a feature the source does not have", async () => {
    const run = subset({ data: await schibsted(), glyphs, features: ["zzzz"] });
    await expect(run).rejects.toBeInstanceOf(GlyphcutError);
    await expect(run).rejects.toThrow(/zzzz/);
  });

  test("reports characters the source does not have", async () => {
    const out = await subset({ data: await schibsted(), glyphs: glyphs + "ž" });
    expect(out.missing).toContain(0x17e);
  });

  test("does not clamp a static font", async () => {
    const data = await fontsourceFile(
      "@fontsource/jetbrains-mono",
      "jetbrains-mono-latin-400-normal.woff2",
    );
    const out = await subset({ data, glyphs, weight: { min: 400, max: 700 } });
    expect((await inspectFont(out.data)).axes.wght).toBeUndefined();
  });

  // Pins the "Done when" size of the site's committed font. It can change with a font update.
  test("matches the site size", async () => {
    const data = await fontsourceFile(
      "@fontsource-variable/jetbrains-mono",
      "jetbrains-mono-latin-wght-normal.woff2",
    );
    const out = await subset({
      data,
      glyphs,
      features: ["calt", "ccmp", "locl", "mark"],
      weight: { min: 400, max: 700 },
    });
    expect(Math.abs(out.data.byteLength - 23852) / 23852).toBeLessThan(0.02);
  });
});
