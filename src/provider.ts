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

export function glyphcut(options: { text: TextOptions }): FontProvider<FamilyOptions> {
  let root: URL | undefined;
  const glyphs = glyphSet(options.text);
  const ranges = unicodeRange(glyphs);

  return {
    name: "glyphcut",
    config: options,
    init(context) {
      root = context.root;
    },
    async resolveFont({ familyName, weights, styles, options: familyOptions }) {
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
      const warned = new Set<number>();
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
          if (warned.has(point)) continue;
          warned.add(point);
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
      return { fonts };
    },
  };
}
