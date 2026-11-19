import { glyphcut } from "astro-glyphcut";
import { defineConfig } from "astro/config";

// A config error: no Fontsource package has this id. The build must fail.
const cut = glyphcut({ text: { ascii: true } });

export default defineConfig({
  fonts: [
    {
      provider: cut.provider,
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      weights: ["400"],
      styles: ["normal"],
      options: { fontsource: "no-such-font" },
    },
    {
      provider: cut.provider,
      name: "Schibsted Grotesk",
      cssVariable: "--font-schibsted-grotesk",
      weights: ["400"],
      styles: ["normal"],
      options: { fontsource: "schibsted-grotesk" },
    },
  ],
});
