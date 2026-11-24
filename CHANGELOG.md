# astro-glyphcut

## 0.3.0

### Minor Changes

- [#10](https://github.com/ecelustka/astro-glyphcut/pull/10) [`65aa450`](https://github.com/ecelustka/astro-glyphcut/commit/65aa45032c14b90a5fb17ecd4f363f67f07e6604) Thanks [@ecelustka](https://github.com/ecelustka)! - With `glyphcutCheck(cut)` in `integrations`, glyphcut's log lines get Astro's timestamp and colors and follow `logLevel` and `--silent`. `--verbose` also lists the fonts that come from the cache. The size line now shows how much smaller each font got: `40 404 → 23 852 B (-41%)`.

## 0.2.0

### Minor Changes

- [#6](https://github.com/ecelustka/astro-glyphcut/pull/6) [`bd16981`](https://github.com/ecelustka/astro-glyphcut/commit/bd16981c2e469637c27cc33fbfc3c5c44a6c1825) Thanks [@ecelustka](https://github.com/ecelustka)! - Support Astro 6.

- [#8](https://github.com/ecelustka/astro-glyphcut/pull/8) [`dea8329`](https://github.com/ecelustka/astro-glyphcut/commit/dea8329c90d448a00bb3e22e5be2f398083dc59c) Thanks [@ecelustka](https://github.com/ecelustka)! - Add a `cacheDir` option that sets the folder for the subset files.

- [#9](https://github.com/ecelustka/astro-glyphcut/pull/9) [`0563ece`](https://github.com/ecelustka/astro-glyphcut/commit/0563ece1306cd88c5a2d5c3c37963a706a32347e) Thanks [@ecelustka](https://github.com/ecelustka)! - Add `glyphcutCheck()`, an integration that warns about page characters outside the glyph set.

## 0.1.1

### Patch Changes

- [`d954680`](https://github.com/ecelustka/astro-glyphcut/commit/d954680471e9b9bb12432d12d453e3a3f427532a) Thanks [@ecelustka](https://github.com/ecelustka)! - Fix: two font entries for the same family resolved at the same time no longer delete each other's cached file. The npm page now links the homepage and issues.

- [`f615a6c`](https://github.com/ecelustka/astro-glyphcut/commit/f615a6c1840d76640dce66521192dc3e5d7cb554) Thanks [@ecelustka](https://github.com/ecelustka)! - README: install as a dev dependency.

## 0.1.0

### Minor Changes

- [`0dcb925`](https://github.com/ecelustka/astro-glyphcut/commit/0dcb9253655a004a0952e82fe464ef0047464383) Thanks [@ecelustka](https://github.com/ecelustka)! - First release: an Astro font provider that subsets fonts at build time.
