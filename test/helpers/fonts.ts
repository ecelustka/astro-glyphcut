import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function fontsourceFile(pkg: string, file: string): Promise<Uint8Array> {
  const path = join(import.meta.dirname, "..", "..", "node_modules", pkg, "files", file);
  return new Uint8Array(await readFile(path));
}
