import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GlyphcutError } from "./subset.ts";

type PackageJson = { name?: string; version?: string };

async function readPackage(path: string): Promise<PackageJson | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as PackageJson;
  } catch {
    return undefined;
  }
}

// These packages block ./package.json in exports, so start at the entry file and walk up.
export async function installedVersion(name: string): Promise<string> {
  let entry: string;
  try {
    entry = import.meta.resolve(name);
  } catch (cause) {
    throw new GlyphcutError(`Cannot find the version of ${name}.`, { cause });
  }
  let dir = dirname(fileURLToPath(entry));
  for (;;) {
    const pkg = await readPackage(join(dir, "package.json"));
    if (pkg?.name === name && pkg.version) return pkg.version;
    const parent = dirname(dir);
    if (parent === dir) throw new GlyphcutError(`Cannot find the version of ${name}.`);
    dir = parent;
  }
}

export async function engineVersions(): Promise<Record<string, string>> {
  // Two levels up from src/core/ and from dist/core/ is the package root.
  const own = await readPackage(join(import.meta.dirname, "..", "..", "package.json"));
  if (!own?.version) throw new GlyphcutError("Cannot find the version of astro-glyphcut.");
  return {
    "astro-glyphcut": own.version,
    "subset-font": await installedVersion("subset-font"),
    harfbuzzjs: await installedVersion("harfbuzzjs"),
  };
}
