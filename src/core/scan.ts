import { decodeHTML } from "entities";
import { ELEMENT_NODE, TEXT_NODE, parse, walkSync } from "ultrahtml";
import type { Node } from "ultrahtml";

/** The browser does not draw this text with the page font. */
const SKIP = new Set(["head", "script", "style", "template"]);
const ATTRIBUTES = ["alt", "placeholder"];

function skipped(node: Node | undefined): boolean {
  for (; node; node = node.parent) {
    if (node.type === ELEMENT_NODE && SKIP.has(node.name.toLowerCase())) return true;
  }
  return false;
}

/** The code points that a page draws with its fonts, without control characters. */
export function pageCodePoints(html: string): Set<number> {
  const points = new Set<number>();
  const add = (raw: string) => {
    for (const char of decodeHTML(raw)) {
      const point = char.codePointAt(0)!;
      if (point >= 0x20 && (point < 0x7f || point > 0x9f)) points.add(point);
    }
  };
  walkSync(parse(html), (node) => {
    if (node.type === TEXT_NODE) {
      if (!skipped(node)) add(node.value);
    } else if (node.type === ELEMENT_NODE && !skipped(node)) {
      for (const name of ATTRIBUTES) if (node.attributes[name]) add(node.attributes[name]);
    }
  });
  return points;
}

/** Each code point that is not in `glyphs`, with its sorted pages, in code point order. */
export function missingCodePoints(
  pages: ReadonlyMap<string, ReadonlySet<number>>,
  glyphs: string,
): Map<number, string[]> {
  const known = new Set(Array.from(glyphs, (char) => char.codePointAt(0)!));
  const missing = new Map<number, string[]>();
  for (const [page, points] of pages) {
    for (const point of points) {
      if (known.has(point)) continue;
      const names = missing.get(point);
      if (names) names.push(page);
      else missing.set(point, [page]);
    }
  }
  return new Map(
    [...missing].sort(([a], [b]) => a - b).map(([point, names]) => [point, names.sort()]),
  );
}
