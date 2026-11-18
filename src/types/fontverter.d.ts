// fontverter ships a global namespace declaration, not a module, so this types the one call in use.
declare module "fontverter" {
  const fontverter: {
    convert(
      buf: Buffer,
      toFormat: "truetype" | "sfnt" | "woff" | "woff2",
      fromFormat?: "truetype" | "sfnt" | "woff" | "woff2",
    ): Promise<Buffer>;
  };
  export default fontverter;
}
