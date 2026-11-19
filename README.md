# astro-glyphcut

[![npm](https://img.shields.io/npm/v/astro-glyphcut)](https://www.npmjs.com/package/astro-glyphcut) [![CI](https://github.com/ecelustka/astro-glyphcut/actions/workflows/ci.yml/badge.svg)](https://github.com/ecelustka/astro-glyphcut/actions/workflows/ci.yml)

An Astro font provider that subsets fonts to the glyphs your site uses, at build time. Astro's Google provider has an `experimental.glyphs` option too, but only for Google fonts, and without control over OpenType features or the weight axis.

```sh
pnpm add -D astro-glyphcut
```

In `astro.config.ts`:

```ts
import { glyphcut, glyphcutCheck } from "astro-glyphcut";
import { defineConfig } from "astro/config";

const cut = glyphcut({ text: { ascii: true, extra: "©«°±·»×–—‘’“”•…− " } });

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
  integrations: [glyphcutCheck(cut)],
});
```

## Options

The `glyphcut()` options are below. `text` sets one glyph set for every family that uses it. The glyph set also becomes the `unicode-range`.

| Option       | Type    | Default                            | What it does                                                                                    |
| ------------ | ------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `text.ascii` | boolean | `false`                            | Adds U+0020 to U+007E.                                                                          |
| `text.extra` | string  | `""`                               | Adds these characters to the glyph set.                                                         |
| `cacheDir`   | string  | `"./node_modules/.astro/glyphcut"` | Folder for the subset files. Relative paths start at the project root. Absolute paths work too. |

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

Weights and styles come from the Astro `weights` and `styles`. A variable font is clamped to the lowest and highest weight (one weight pins it), and a static file keeps its own weight. Weights are numbers, `"normal"` (400) or `"bold"` (700). Astro's `styles` default to normal and italic, so each listed style needs a source. In the list form only files with a weight inside the range and a style in `styles` are used.

Astro's `subsets` and `formats` family fields are ignored. Use `options.subset` to pick a Fontsource subset. The output is always woff2.

## Errors and warnings

A Fontsource package that is not installed, a missing file, style or feature, a static file without a weight when `weights` is a range, an unknown weight keyword, or both or neither of `fontsource` and `src` is an error. The error is logged with the `[glyphcut]` prefix and `astro build` exits with code 1. `astro dev` keeps running without that font. A character the font lacks only logs a warning, prefixed with `[glyphcut]`, and the browser uses the fallback font for it.

## Check the pages

`glyphcutCheck(cut)` is an Astro integration. After `astro build` it reads every `.html` file in the output and warns about each character that is not in the glyph set:

```
[WARN] [glyphcut] "€" (U+20AC) is not in the glyph set: about/index.html, pricing/index.html and 3 more
```

It reads text nodes and `alt` and `placeholder` values. It skips `head`, `script`, `style`, `template`, comments, `title` and `aria-label` attributes, and control characters. It does not run in `astro dev`, and it does not see pages rendered on request or text that JavaScript adds in the browser.

With `glyphcutCheck(cut, { strict: true })`, `astro build` exits with code 1 when a character is missing.

## Cache

Subsets go to `node_modules/.astro/glyphcut/` and are rebuilt when the font, options or engine versions change. Delete the folder to clear it. The `cacheDir` option moves the folder. Astro's own `cacheDir` does not. On Netlify, add `node_modules/.astro` to the cache. With a custom `cacheDir`, cache that folder instead.

## Requirements

Node 22.12 or later and Astro 6 or 7.

## Licenses

Check that your font's license allows subsetting and self-hosting.

## Development

`pnpm verify` runs lint, format, types, knip, package checks and tests. Run `pnpm changeset` for a changelog entry.

## License

MIT
