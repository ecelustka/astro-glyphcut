import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration, FontProvider } from "astro";

import { missingCodePoints, pageCodePoints } from "./core/scan.ts";
import type { FamilyOptions } from "./core/sources.ts";
import { GlyphcutError } from "./core/subset.ts";
import { formatPoint, glyphSet } from "./core/text.ts";
import type { TextOptions } from "./core/text.ts";

export type CheckOptions = { strict?: boolean };

/** Warns about page characters that are not in the glyph set of `provider`. */
export function glyphcutCheck(
  provider: FontProvider<FamilyOptions>,
  options?: CheckOptions,
): AstroIntegration {
  const text = provider.config?.["text"] as TextOptions | undefined;
  if (provider.name !== "glyphcut" || !text) {
    throw new GlyphcutError("glyphcutCheck needs a provider from glyphcut().");
  }
  return checkIntegration(glyphSet(text), options);
}

function checkIntegration(glyphs: string, options: CheckOptions = {}): AstroIntegration {
  return {
    name: "glyphcut",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const pages = new Map<string, Set<number>>();
        for (const file of await readdir(root, { recursive: true })) {
          if (!file.endsWith(".html")) continue;
          pages.set(
            file.split(sep).join("/"),
            pageCodePoints(await readFile(join(root, file), "utf8")),
          );
        }

        const missing = missingCodePoints(pages, glyphs);
        if (missing.size === 0) {
          const count = pages.size === 1 ? "1 page" : `${pages.size} pages`;
          logger.info(`all characters of ${count} are in the glyph set`);
          return;
        }
        for (const [point, names] of missing) {
          const more = names.length > 2 ? ` and ${names.length - 2} more` : "";
          logger.warn(
            `"${String.fromCodePoint(point)}" (${formatPoint(point)}) is not in the glyph set: ${names.slice(0, 2).join(", ")}${more}`,
          );
        }
        if (options.strict) {
          const count = missing.size === 1 ? "1 character is" : `${missing.size} characters are`;
          throw new GlyphcutError(`${count} not in the glyph set. See the warnings above.`);
        }
      },
    },
  };
}
