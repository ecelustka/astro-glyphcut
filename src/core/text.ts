export type TextOptions = { ascii?: boolean; extra?: string };

const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) =>
  String.fromCodePoint(0x20 + i),
).join("");

/** The glyphs to keep: deduplicated and sorted by code point. */
export function glyphSet(text: TextOptions): string {
  const points = new Set<number>();
  for (const char of (text.ascii ? ASCII : "") + (text.extra ?? "")) {
    points.add(char.codePointAt(0)!);
  }
  return [...points]
    .sort((a, b) => a - b)
    .map((point) => String.fromCodePoint(point))
    .join("");
}

/** Compact CSS unicode-range values, for example `["U+20-7E", "U+A0"]`. */
export function unicodeRange(glyphs: string): string[] {
  const points = [...new Set(Array.from(glyphs).map((char) => char.codePointAt(0)!))].sort(
    (a, b) => a - b,
  );
  const hex = (n: number) => n.toString(16).toUpperCase();
  const ranges: string[] = [];
  for (let i = 0; i < points.length;) {
    const start = points[i]!;
    let end = start;
    i++;
    while (i < points.length && points[i] === end + 1) end = points[i++]!;
    ranges.push(start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`);
  }
  return ranges;
}

/** 382 becomes "U+017E". */
export function formatPoint(point: number): string {
  return `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
}
