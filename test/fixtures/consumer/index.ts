import { glyphcut, glyphcutCheck, GlyphcutError } from "astro-glyphcut";
import type {
  CheckOptions,
  FamilyOptions,
  GlyphcutOptions,
  SrcOption,
  TextOptions,
} from "astro-glyphcut";
import { defineConfig } from "astro/config";

const text: TextOptions = { ascii: true, extra: "→" };
const options: GlyphcutOptions = { text };
const provider = glyphcut(options);
glyphcut({ text, cacheDir: "./.cache/glyphcut" });
const strict: CheckOptions = { strict: true };
const error: Error = new GlyphcutError("x");
void error;

const single: SrcOption = "./fonts/a.woff2";
const perStyle: SrcOption = { normal: "./fonts/a.woff2", italic: "./fonts/a-italic.woff2" };
const list: SrcOption = [{ path: "./fonts/a-400.woff2", weight: "400", style: "normal" }];
const fromFontsource: FamilyOptions = { fontsource: "jetbrains-mono", features: ["calt"] };

export default defineConfig({
  fonts: [
    { provider, name: "A", cssVariable: "--font-a", options: { src: single } },
    { provider, name: "B", cssVariable: "--font-b", options: { src: perStyle, subset: "latin" } },
    { provider, name: "C", cssVariable: "--font-c", options: { src: list } },
    { provider, name: "D", cssVariable: "--font-d", options: fromFontsource },
  ],
  integrations: [glyphcutCheck(provider, strict)],
});

// Negative cases: each line must be a type error, so a lost FamilyOptions type fails the check.
defineConfig({
  fonts: [
    // @ts-expect-error src must be a string, an object or a list
    { provider, name: "E", cssVariable: "--font-e", options: { src: 42 } },
    // @ts-expect-error fontsource must be a string
    { provider, name: "F", cssVariable: "--font-f", options: { fontsource: 1 } },
    // @ts-expect-error unknown option key
    { provider, name: "G", cssVariable: "--font-g", options: { fontsource: "x", nope: true } },
  ],
});

// @ts-expect-error ascii must be a boolean
glyphcut({ text: { ascii: "yes" } });

// @ts-expect-error cacheDir must be a string
glyphcut({ text, cacheDir: 1 });

// @ts-expect-error strict must be a boolean
glyphcutCheck(provider, { strict: "yes" });
