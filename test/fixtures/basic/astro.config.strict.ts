import { glyphcut } from "astro-glyphcut";
import { defineConfig } from "astro/config";

// The 29 non-ASCII characters of celustka.dev.
const extra = " ©«°±·»×‐–—‘’‚“”„•…′″‹›←↑→↓−";

// The page has "ž", which is not in the glyph set. The strict check must fail the build.
const cut = glyphcut({ text: { ascii: true, extra } });

export default defineConfig({
  fonts: [
    {
      provider: cut.provider,
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      weights: ["400 700"],
      styles: ["normal"],
      fallbacks: ["ui-monospace", "monospace"],
      options: { fontsource: "jetbrains-mono", features: ["calt", "ccmp", "locl", "mark"] },
    },
    // The same family and style again with another weight. Both cache files must survive.
    {
      provider: cut.provider,
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono-bold",
      weights: ["700"],
      styles: ["normal"],
      fallbacks: ["ui-monospace", "monospace"],
      options: { fontsource: "jetbrains-mono", features: ["calt", "ccmp", "locl", "mark"] },
    },
    {
      provider: cut.provider,
      name: "Schibsted Grotesk",
      cssVariable: "--font-schibsted-grotesk",
      weights: ["400 800"],
      styles: ["normal", "italic"],
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        fontsource: "schibsted-grotesk",
        features: ["ccmp", "kern", "liga", "locl", "mark", "mkmk", "tnum"],
      },
    },
  ],
  integrations: [cut.check({ strict: true })],
});
