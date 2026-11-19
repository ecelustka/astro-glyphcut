import { parse } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

/** The browser does not draw this text with the page font. */
const SKIP = new Set(["head", "script", "style", "template"]);
const ATTRIBUTES = new Set(["alt", "placeholder"]);

/** The code points that a page draws with its fonts, without control characters. */
export function pageCodePoints(html: string): Set<number> {
  const points = new Set<number>();
  const add = (text: string) => {
    for (const char of text) {
      const point = char.codePointAt(0)!;
      if (point >= 0x20 && (point < 0x7f || point > 0x9f)) points.add(point);
    }
  };
  // parse5 decodes entities and lowercases tag names.
  const walk = (node: DefaultTreeAdapterTypes.Node) => {
    if (SKIP.has(node.nodeName)) return;
    if (node.nodeName === "#text" && "value" in node) add(node.value);
    if ("attrs" in node) {
      for (const attr of node.attrs) if (ATTRIBUTES.has(attr.name)) add(attr.value);
    }
    if ("childNodes" in node) node.childNodes.forEach(walk);
  };
  walk(parse(html));
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
