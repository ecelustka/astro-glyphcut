import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function fontsourceFile(pkg: string, file: string): Promise<Uint8Array> {
  const path = join(import.meta.dirname, "..", "..", "node_modules", pkg, "files", file);
  return new Uint8Array(await readFile(path));
}

/** The 29 non-ASCII characters of celustka.dev (scripts/subset-fonts.ts `extra`). */
export const SITE_EXTRA =
  "\u00a0\u00a9\u00ab\u00b0\u00b1\u00b7\u00bb\u00d7\u2010\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2022\u2026\u2032\u2033\u2039\u203a\u2190\u2191\u2192\u2193\u2212";
