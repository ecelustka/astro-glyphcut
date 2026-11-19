import { expect, test } from "vitest";

import { missingCodePoints, pageCodePoints } from "./scan.ts";

const set = (text: string) => new Set(Array.from(text, (char) => char.codePointAt(0)!));
const chars = (points: Set<number>) =>
  [...points]
    .sort((a, b) => a - b)
    .map((point) => String.fromCodePoint(point))
    .join("");

test("decodes entities in text", () => {
  expect(chars(pageCodePoints("<p>a&copy;&#8594;&#x2192;</p>"))).toBe("a©→");
});

test("counts alt and placeholder values", () => {
  expect(chars(pageCodePoints('<img alt="ž &amp; x"><input placeholder="ř">'))).toBe(" &xřž");
});

test("skips head, script, style, template, comments, title, aria-label and control characters", () => {
  const html = [
    "<html><head><title>Ω</title></head><body>",
    '<script>"Ω"</script><style>.a{content:"Ω"}</style>',
    "<template>Ω</template><!-- Ω -->",
    '<a title="Ω" aria-label="Ω">a</a>',
    "<p>\n\tb\u0085</p>",
    "</body></html>",
  ].join("");
  expect(chars(pageCodePoints(html))).toBe("ab");
});

test("lists missing characters with sorted pages", () => {
  const pages = new Map([
    ["b.html", set("ž→")],
    ["a.html", set("ž")],
  ]);
  expect(missingCodePoints(pages, "→")).toEqual(new Map([[0x17e, ["a.html", "b.html"]]]));
});

test("sorts missing characters by code point", () => {
  const missing = missingCodePoints(new Map([["a.html", set("ž©")]]), "");
  expect([...missing.keys()]).toEqual([0xa9, 0x17e]);
});
