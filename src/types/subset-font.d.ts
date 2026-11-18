// @types/subset-font lags the package and has no keepFeatures, so this covers the options in use.
declare module "subset-font" {
  interface SubsetFontOptions {
    targetFormat?: "sfnt" | "woff" | "woff2" | "truetype";
    keepFeatures?: string[];
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
  }

  export default function subsetFont(
    buffer: Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Uint8Array>;
}
