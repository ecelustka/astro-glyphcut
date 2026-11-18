import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SourceFile } from "./sources.ts";
import { subset } from "./subset.ts";
import { engineVersions } from "./versions.ts";

export type CacheKeyParts = {
  source: Uint8Array;
  glyphs: string;
  features?: string[];
  weight?: { min: number; max: number };
  versions: Record<string, string>;
};

export function cacheKey(parts: CacheKeyParts): string {
  const { source, glyphs, features, weight, versions } = parts;
  const hash = createHash("sha256");
  hash.update(source);
  hash.update(
    JSON.stringify({ glyphs, features: features ?? null, weight: weight ?? null, versions }),
  );
  return hash.digest("hex").slice(0, 12);
}

export function kebab(family: string): string {
  return family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The readable part of a cache file name: `schibsted-grotesk-normal` or `...-normal-700`. */
export function cacheLabel(family: string, style: string, weight?: number): string {
  return `${kebab(family)}-${style}${weight === undefined ? "" : `-${weight}`}`;
}

function filePrefix(family: string, style: string, weight: number | undefined): string {
  return `${cacheLabel(family, style, weight)}-`;
}

export function cacheFileName(
  family: string,
  style: string,
  weight: number | undefined,
  key: string,
): string {
  return `${filePrefix(family, style, weight)}${key}.woff2`;
}

export type CachedSubsetInput = {
  dir: URL;
  family: string;
  source: SourceFile;
  glyphs: string;
  features?: string[];
  weight?: { min: number; max: number };
};

export type CachedSubsetResult = {
  path: string;
  created: boolean;
  sizes?: { before: number; after: number };
  missing: number[];
  variable: boolean;
};

type Sidecar = { missing: number[]; variable: boolean };

async function readSidecar(path: string): Promise<Sidecar | undefined> {
  try {
    const value = JSON.parse(await readFile(`${path}.json`, "utf8")) as Partial<Sidecar>;
    if (Array.isArray(value.missing) && typeof value.variable === "boolean") {
      return { missing: value.missing, variable: value.variable };
    }
  } catch {
    // A missing or broken sidecar means a cache miss.
  }
  return undefined;
}

async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const temp = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temp, data);
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

// Match the exact name: prefix, 12 hex characters, then the extension.
// A longer family name with the same start does not match.
async function removeStale(dir: string, prefix: string, keep: string): Promise<void> {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}[0-9a-f]{12}\\.woff2(\\.json)?(\\.tmp-\\d+)?$`);
  for (const name of await readdir(dir)) {
    if (pattern.test(name) && name !== keep && name !== `${keep}.json`) {
      await rm(join(dir, name), { force: true });
    }
  }
}

export async function cachedSubset(input: CachedSubsetInput): Promise<CachedSubsetResult> {
  const { family, source, glyphs, features, weight } = input;
  const dir = fileURLToPath(input.dir);
  await mkdir(dir, { recursive: true });

  const data = new Uint8Array(await readFile(source.path));
  const key = cacheKey({
    source: data,
    glyphs,
    features,
    weight,
    versions: await engineVersions(),
  });
  const name = cacheFileName(family, source.style, source.weight, key);
  const path = join(dir, name);

  const cached = await readSidecar(path);
  if (cached) {
    try {
      await readFile(path);
      return { path, created: false, ...cached };
    } catch {
      // The font file is gone: build it again.
    }
  }

  const result = await subset({ data, glyphs, features, weight });
  await writeAtomic(path, result.data);
  await writeAtomic(
    `${path}.json`,
    JSON.stringify({ missing: result.missing, variable: result.variable }),
  );
  await removeStale(dir, filePrefix(family, source.style, source.weight), name);
  return {
    path,
    created: true,
    sizes: { before: data.length, after: result.data.length },
    missing: result.missing,
    variable: result.variable,
  };
}
