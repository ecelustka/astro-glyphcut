# astro-glyphcut

An Astro font provider that subsets fonts to the glyphs your site uses, at build time. Astro's Google provider has an `experimental.glyphs` option too, but only for Google fonts, and without control over OpenType features or the weight axis.

```sh
pnpm add astro-glyphcut
```

In `astro.config.ts`:

```ts
import { glyphcut } from "astro-glyphcut";
import { defineConfig } from "astro/config";

const cut = glyphcut({ text: { ascii: true, extra: "©«°±·»×‐–—‘’“”•…→− " } });

export default defineConfig({
  fonts: [
    {
      provider: cut,
      name: "Schibsted Grotesk",
      cssVariable: "--font-schibsted-grotesk",
      weights: ["400 800"],
      styles: ["normal", "italic"],
      options: { fontsource: "schibsted-grotesk", features: ["kern", "liga", "tnum"] },
    },
    {
      provider: cut,
      name: "Brand",
      cssVariable: "--font-brand",
      weights: ["400", "700"],
      styles: ["normal"],
      options: {
        src: [
          { path: "./fonts/Brand-Regular.otf", weight: "400", style: "normal" },
          { path: "./fonts/Brand-Bold.otf", weight: "700", style: "normal" },
        ],
      },
    },
  ],
});
```

## Options

`glyphcut({ text })` sets one glyph set for every family that uses it. The glyph set also becomes the `unicode-range`.

| Option       | Type    | Default | What it does                            |
| ------------ | ------- | ------- | --------------------------------------- |
| `text.ascii` | boolean | `false` | Adds U+0020 to U+007E.                  |
| `text.extra` | string  | `""`    | Adds these characters to the glyph set. |

Per-family `options`. Set `fontsource` or `src`, not both.

| Option       | Type      | Default   | What it does                                                                             |
| ------------ | --------- | --------- | ---------------------------------------------------------------------------------------- |
| `fontsource` | string    |           | Fontsource id. Uses `@fontsource-variable/<id>` if installed, else `@fontsource/<id>`.   |
| `src`        | see below |           | Local `.ttf`, `.otf`, `.woff` or `.woff2` files. Paths are relative to the project root. |
| `features`   | string[]  | all       | OpenType features to keep. `[]` keeps none. A feature the font lacks is a build error.   |
| `subset`     | string    | `"latin"` | Fontsource subset to read.                                                               |

```ts
src: "./fonts/Brand.ttf" // one file, normal style only
src: { normal: "./fonts/Brand.ttf", italic: "./fonts/Brand-Italic.ttf" } // keys: normal, italic, oblique
src: [{ path: "./fonts/Brand-Bold.otf", weight: "700", style: "normal" }] // static files
```

Weights and styles come from the Astro `weights` and `styles`. A variable font is clamped to the lowest and highest weight (one weight pins it), and a static file keeps its own weight. Astro's `styles` default to normal and italic, so each listed style needs a source. In the list form only files with a weight inside the range and a style in `styles` are used.

## Errors and warnings

A Fontsource package that is not installed, a missing file, style or feature, a file without a weight when `weights` is a range, or both or neither of `fontsource` and `src` stops the build. A character the font lacks only logs a warning, prefixed with `[glyphcut]`, and the browser uses the fallback font for it.

## Cache

Subsets go to `node_modules/.astro/glyphcut/` and are rebuilt when the font, options or engine versions change. Delete the folder to clear it. On Netlify, add `node_modules/.astro` to the cache.

## Requirements

Node 22.12 or later and Astro 7.

## Licenses

Check that your font's license allows subsetting and self-hosting.

## Development

`pnpm verify` runs lint, format, types, knip, package checks and tests. Run `pnpm changeset` for a changelog entry.

## License

MIT
