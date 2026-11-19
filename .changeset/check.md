---
"astro-glyphcut": minor
---

Breaking: `glyphcut()` returns `{ provider, check }`. Use `provider: cut.provider` in `fonts`. Add `cut.check()` to `integrations` to find page characters that are not in the glyph set.
