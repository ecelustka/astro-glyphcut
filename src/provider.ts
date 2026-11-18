import type { FontProvider } from "astro";

import { cachedSubset, cacheLabel, kebab } from "./core/cache.ts";
import { findSources, weightRange } from "./core/sources.ts";
import type { FamilyOptions, SourceFile } from "./core/sources.ts";
import { GlyphcutError } from "./core/subset.ts";
import { glyphSet, unicodeRange } from "./core/text.ts";
import type { TextOptions } from "./core/text.ts";

const PREFIX = "[glyphcut]";

/** 46752 becomes "46 752". */
function groups(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPoint(point: number): string {
  return `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
}

function fontWeight(
  family: string,
  source: SourceFile,
  variable: boolean,
  range: { min: number; max: number },
): string {
  if (variable) return range.min === range.max ? String(range.min) : `${range.min} ${range.max}`;
  if (source.weight !== undefined) return String(source.weight);
  if (range.min === range.max) return String(range.min);
  throw new GlyphcutError(
    `Font ${family} has a file without a weight, but the weights are ${range.min}-${range.max}. Use the src list form with a weight for each file.`,
  );
}

export type GlyphcutOptions = { text: TextOptions };

/** Keep exit code 1, also after a process.exit(0). */
function keepFailure(): void {
  if (!process.exitCode) process.exitCode = 1;
}

/**
 * Astro catches provider errors and only logs them, so the build finishes. Set exit code 1 and
 * keep it at exit: the astro CLI calls process.exit(0) after a build, which replaces
 * process.exitCode. See astro/bin/astro.mjs:
 * https://github.com/withastro/astro/blob/main/packages/astro/bin/astro.mjs
 * The dev server keeps running.
 */
function fail(): void {
  process.exitCode = 1;
  if (!process.listeners("exit").includes(keepFailure)) process.once("exit", keepFailure);
}

export function glyphcut(options: GlyphcutOptions): FontProvider<FamilyOptions> {
  let root: URL | undefined;
  const glyphs = glyphSet(options.text);
  const ranges = unicodeRange(glyphs);
  // One warning for each family and character, and one line for each error, in this process.
  const warned = new Set<string>();
  const errors = new Set<string>();

  function report(error: unknown): void {
    fail();
    if (!(error instanceof GlyphcutError)) {
      console.error(`${PREFIX} Unexpected error. Astro prints the details below.`);
    } else if (!errors.has(error.message)) {
      errors.add(error.message);
      console.error(`${PREFIX} ${error.message}`);
    }
  }

  return {
    name: "glyphcut",
    config: options,
    init(context) {
      root = context.root;
    },
    async resolveFont(input) {
      try {
        return { fonts: await resolve(input) };
      } catch (error) {
        report(error);
        // A config error has a clear message. Return no fonts so that Astro does not add a stack trace.
        if (error instanceof GlyphcutError) return { fonts: [] };
        throw error;
      }
    },
  };

  async function resolve({
    familyName,
    weights,
    styles,
    options: familyOptions,
  }: Parameters<FontProvider<FamilyOptions>["resolveFont"]>[0]) {
    if (!root) throw new GlyphcutError("The glyphcut provider was used before init.");
    const dir = new URL("node_modules/.astro/glyphcut/", root);
    const range = weightRange(weights);
    const family = kebab(familyName);

    const sources = await findSources({
      root,
      family: familyName,
      options: familyOptions ?? {},
      weights,
      styles,
    });

    const fonts = [];
    for (const source of sources) {
      const result = await cachedSubset({
        dir,
        family: familyName,
        source,
        glyphs,
        features: familyOptions?.features,
        weight: range,
      });

      if (result.created && result.sizes) {
        const label = cacheLabel(familyName, source.style, source.weight);
        console.info(
          `${PREFIX} ${label}: ${groups(result.sizes.before)} → ${groups(result.sizes.after)} B`,
        );
      }
      for (const point of result.missing) {
        const key = `${family}:${point}`;
        if (warned.has(key)) continue;
        warned.add(key);
        console.warn(
          `${PREFIX} ${family}: no glyph for "${String.fromCodePoint(point)}" (${formatPoint(point)})`,
        );
      }

      fonts.push({
        src: [{ url: result.path, format: "woff2" as const }],
        weight: fontWeight(familyName, source, result.variable, range),
        style: source.style,
        unicodeRange: ranges,
      });
    }
    return fonts;
  }
}
