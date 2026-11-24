import type { AstroIntegrationLogger, FontProvider } from "astro";

import { cachedSubset, cacheLabel, cacheUrl, kebab } from "./core/cache.ts";
import { findSources, weightRange } from "./core/sources.ts";
import type { FamilyOptions, SourceFile } from "./core/sources.ts";
import { GlyphcutError } from "./core/subset.ts";
import { formatPoint, glyphSet, unicodeRange } from "./core/text.ts";
import type { TextOptions } from "./core/text.ts";

const PREFIX = "[glyphcut]";

type Logger = Pick<AstroIntegrationLogger, "info" | "warn" | "error" | "debug">;

const consoleLogger: Logger = {
  info: (message) => console.info(`${PREFIX} ${message}`),
  warn: (message) => console.warn(`${PREFIX} ${message}`),
  error: (message) => console.error(`${PREFIX} ${message}`),
  // The console has no log level, so debug lines would always print.
  debug: () => {},
};

// Astro gives providers no logger, so glyphcutCheck passes in its own. Astro rejects unknown
// keys on a provider, so this map holds it.
const loggers = new WeakMap<FontProvider<FamilyOptions>, Logger>();

export function setLogger(provider: FontProvider<FamilyOptions>, logger: Logger): void {
  loggers.set(provider, logger);
}

/** 46752 becomes "46 752". */
function groups(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

export type GlyphcutOptions = { text: TextOptions; cacheDir?: string };

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
  const log = (): Logger => loggers.get(provider) ?? consoleLogger;

  function report(error: unknown): void {
    fail();
    if (!(error instanceof GlyphcutError)) {
      log().error("Unexpected error. Astro prints the details below.");
    } else if (!errors.has(error.message)) {
      errors.add(error.message);
      log().error(error.message);
    }
  }

  const provider: FontProvider<FamilyOptions> = {
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
  return provider;

  async function resolve({
    familyName,
    weights,
    styles,
    options: familyOptions,
  }: Parameters<FontProvider<FamilyOptions>["resolveFont"]>[0]) {
    if (!root) throw new GlyphcutError("The glyphcut provider was used before init.");
    const dir = cacheUrl(root, options.cacheDir);
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

      const label = cacheLabel(familyName, source.style, source.weight);
      if (result.created && result.sizes) {
        const { before, after } = result.sizes;
        const change = Math.round((after / before - 1) * 100);
        log().info(
          `${label}: ${groups(before)} → ${groups(after)} B (${change > 0 ? "+" : ""}${change}%)`,
        );
      } else {
        log().debug(`${label}: cached`);
      }
      for (const point of result.missing) {
        const key = `${family}:${point}`;
        if (warned.has(key)) continue;
        warned.add(key);
        log().warn(
          `${family}: no glyph for "${String.fromCodePoint(point)}" (${formatPoint(point)})`,
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
