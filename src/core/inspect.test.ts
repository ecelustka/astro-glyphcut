import { expect, test } from "vitest";

import { fontsourceFile } from "./fonts.test-utils.ts";
import { inspectFont } from "./inspect.ts";

test("reads the Schibsted Grotesk variable latin file", async () => {
  const info = await inspectFont(
    await fontsourceFile(
      "@fontsource-variable/schibsted-grotesk",
      "schibsted-grotesk-latin-wght-normal.woff2",
    ),
  );
  expect(info.codepoints.has(0x41)).toBe(true);
  expect(info.features).toContain("kern");
  expect(info.axes.wght).toMatchObject({ min: 400, max: 900 });
});

test("a static file has no wght axis", async () => {
  const info = await inspectFont(
    await fontsourceFile("@fontsource/jetbrains-mono", "jetbrains-mono-latin-400-normal.woff2"),
  );
  expect(info.axes.wght).toBeUndefined();
});
