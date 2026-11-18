import { access } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GlyphcutError } from "./subset.ts";

type Style = "normal" | "italic" | "oblique";

export type SrcOption =
  | string
  | Partial<Record<Style, string>>
  | Array<{ path: string; weight: string | number; style: Style }>;

export type FamilyOptions = {
  fontsource?: string;
  src?: SrcOption;
  features?: string[];
  subset?: string;
};

export type SourceFile = { path: string; style: Style; weight?: number; variable: boolean };

export type FindSourcesInput = {
  root: URL;
  family: string;
  options: FamilyOptions;
  weights: Array<string | number>;
  styles: Style[];
};

const STATIC_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function weightNumbers(weights: Array<string | number>): number[] {
  return weights.flatMap((weight) =>
    String(weight)
      .trim()
      .split(/\s+/)
      .map((part) => Number(part)),
  );
}

export function weightRange(weights: Array<string | number>): { min: number; max: number } {
  const numbers = weightNumbers(weights).filter((n) => Number.isFinite(n));
  if (numbers.length === 0) {
    throw new GlyphcutError(`No usable font weight in ${JSON.stringify(weights)}.`);
  }
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Find a package like Node does: walk up from `root` and check node_modules/<pkg>. */
async function findPackage(root: URL, pkg: string): Promise<string | undefined> {
  let dir = fileURLToPath(root);
  for (;;) {
    const candidate = join(dir, "node_modules", pkg);
    if (await exists(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

async function fromFontsource(input: FindSourcesInput, id: string): Promise<SourceFile[]> {
  const { root, options, weights, styles } = input;
  const subsetName = options.subset ?? "latin";

  const variableDir = await findPackage(root, `@fontsource-variable/${id}`);
  if (variableDir) {
    const files: SourceFile[] = [];
    for (const style of styles) {
      const path = join(variableDir, "files", `${id}-${subsetName}-wght-${style}.woff2`);
      if (!(await exists(path))) {
        throw new GlyphcutError(
          `@fontsource-variable/${id} has no ${style} style for subset ${subsetName}. Expected ${path}.`,
        );
      }
      files.push({ path, style, variable: true });
    }
    return files;
  }

  const staticDir = await findPackage(root, `@fontsource/${id}`);
  if (!staticDir) {
    throw new GlyphcutError(
      `Fontsource package for "${id}" not found from ${fileURLToPath(root)}. Run: pnpm add @fontsource-variable/${id}`,
    );
  }

  const isRange = weights.length === 1 && String(weights[0]).trim().includes(" ");
  const wanted = isRange
    ? (() => {
        const { min, max } = weightRange(weights);
        return STATIC_WEIGHTS.filter((w) => w >= min && w <= max);
      })()
    : weightNumbers(weights);

  const files: SourceFile[] = [];
  for (const style of styles) {
    let found = 0;
    for (const weight of wanted) {
      const path = join(staticDir, "files", `${id}-${subsetName}-${weight}-${style}.woff2`);
      if (await exists(path)) {
        files.push({ path, style, weight, variable: false });
        found++;
      } else if (!isRange) {
        throw new GlyphcutError(
          `@fontsource/${id} has no ${weight} ${style} file for subset ${subsetName}. Expected ${path}.`,
        );
      }
    }
    if (found === 0) {
      throw new GlyphcutError(
        `@fontsource/${id} has no ${style} files for weights ${wanted.join(", ")} in subset ${subsetName}.`,
      );
    }
  }
  return files;
}

async function checked(path: string, style: Style, weight?: number): Promise<SourceFile> {
  if (!(await exists(path))) {
    throw new GlyphcutError(`Font file not found: ${path}`);
  }
  return { path, style, ...(weight !== undefined && { weight }), variable: false };
}

async function fromSrc(input: FindSourcesInput, src: SrcOption): Promise<SourceFile[]> {
  const { root, family, weights, styles } = input;
  const base = fileURLToPath(root);
  const abs = (path: string) => (isAbsolute(path) ? path : resolve(base, path));

  if (typeof src === "string") {
    const extra = styles.filter((style) => style !== "normal");
    if (extra.length > 0) {
      throw new GlyphcutError(
        `src for ${family} is a single file, which has only the normal style. Missing: ${extra.join(", ")}.`,
      );
    }
    return [await checked(abs(src), "normal")];
  }

  if (Array.isArray(src)) {
    const range = weightRange(weights);
    const files: SourceFile[] = [];
    for (const style of styles) {
      const matches = src.filter((entry) => {
        const weight = Number(entry.weight);
        return entry.style === style && weight >= range.min && weight <= range.max;
      });
      if (matches.length === 0) {
        throw new GlyphcutError(
          `src for ${family} has no ${style} entry for weights ${range.min}-${range.max}.`,
        );
      }
      for (const entry of matches) {
        files.push(await checked(abs(entry.path), style, Number(entry.weight)));
      }
    }
    return files;
  }

  const files: SourceFile[] = [];
  for (const style of styles) {
    const path = src[style];
    if (!path) {
      throw new GlyphcutError(
        `src for ${family} has no ${style} style. It has: ${Object.keys(src).join(", ")}.`,
      );
    }
    files.push(await checked(abs(path), style));
  }
  return files;
}

export async function findSources(input: FindSourcesInput): Promise<SourceFile[]> {
  const { family, options } = input;
  if (options.fontsource && options.src) {
    throw new GlyphcutError(`Font ${family} sets both fontsource and src. Use only one.`);
  }
  if (options.fontsource) return fromFontsource(input, options.fontsource);
  if (options.src) return fromSrc(input, options.src);
  throw new GlyphcutError(`Font ${family} needs either fontsource or src.`);
}
