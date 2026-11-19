import { fileURLToPath } from "node:url";

import { build } from "astro";
import { expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

const root = fileURLToPath(new URL("../fixtures/basic/", import.meta.url));

it("fails a strict build when a page has a character outside the glyph set", async () => {
  await expect(
    build({ root, configFile: "astro.config.strict.ts", logLevel: "silent" }),
  ).rejects.toThrow(/1 characters? (is|are) not in the glyph set/);
});
