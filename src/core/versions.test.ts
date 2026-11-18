import { expect, test } from "vitest";

import { GlyphcutError } from "./subset.ts";
import { installedVersion } from "./versions.ts";

test("an unresolvable package throws a GlyphcutError that names it", async () => {
  const error = await installedVersion("glyphcut-no-such-package").catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GlyphcutError);
  expect((error as Error).message).toContain("glyphcut-no-such-package");
  expect((error as Error).cause).toBeDefined();
});
