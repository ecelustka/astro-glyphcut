import subsetFont from "subset-font";

import { inspectFont } from "./inspect.ts";

export class GlyphcutError extends Error {
  override name = "GlyphcutError";
}

export type SubsetInput = {
  data: Uint8Array;
  glyphs: string;
  features?: string[];
  weight?: { min: number; max: number };
};

export type SubsetResult = { data: Uint8Array; missing: number[]; variable: boolean };

export async function subset(input: SubsetInput): Promise<SubsetResult> {
  const { data, glyphs, features, weight } = input;
  const source = await inspectFont(data);

  if (features) {
    const unknown = features.filter((tag) => !source.features.has(tag));
    if (unknown.length > 0) {
      throw new GlyphcutError(
        `The font has no feature ${unknown.join(", ")}. Available: ${[...source.features].sort().join(", ")}.`,
      );
    }
  }

  const missing = [...new Set(Array.from(glyphs).map((char) => char.codePointAt(0)!))].filter(
    (point) => !source.codepoints.has(point),
  );

  // subset-font reads the input with Buffer methods, so a plain Uint8Array fails.
  const out = await subsetFont(Buffer.from(data), glyphs, {
    targetFormat: "woff2",
    ...(features && { keepFeatures: features }),
    ...(weight && source.axes.wght && { variationAxes: { wght: weight } }),
  });
  return { data: new Uint8Array(out), missing, variable: "wght" in source.axes };
}
