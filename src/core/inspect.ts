import fontverter from "fontverter";
import { Blob, Face } from "harfbuzzjs";

export type FontInfo = {
  codepoints: Set<number>;
  features: Set<string>;
  axes: Record<string, { min: number; max: number; default: number }>;
};

export async function inspectFont(data: Uint8Array): Promise<FontInfo> {
  const sfnt = await fontverter.convert(Buffer.from(data), "sfnt");
  // harfbuzzjs 1.6 has no destroy(): a FinalizationRegistry frees the blob and face on GC.
  const face = new Face(new Blob(sfnt));

  const axes: FontInfo["axes"] = {};
  for (const [tag, axis] of Object.entries(face.getAxisInfos())) {
    axes[tag] = { min: axis.min, max: axis.max, default: axis.default };
  }

  return {
    codepoints: new Set(face.collectUnicodes()),
    features: new Set([...face.getTableFeatureTags("GSUB"), ...face.getTableFeatureTags("GPOS")]),
    axes,
  };
}
