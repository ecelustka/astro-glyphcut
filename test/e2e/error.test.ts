import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const fixture = fileURLToPath(new URL("../fixtures/basic/", import.meta.url));
const astro = join(fixture, "node_modules/astro/bin/astro.mjs");
let out = "";
let code: number | null = null;
let output = "";

beforeAll(async () => {
  const env = { ...process.env };
  delete env["VITEST"];
  out = await mkdtemp(join(tmpdir(), "glyphcut-error-"));
  // A child process keeps the build's process.exitCode out of vitest.
  await new Promise<void>((done) => {
    execFile(
      process.execPath,
      [astro, "build", "--config", "astro.config.bad.ts", "--outDir", out],
      { cwd: fixture, env },
      (error, stdout, stderr) => {
        code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        output = `${stdout}${stderr}`;
        done();
      },
    );
  });
});

afterAll(async () => {
  await rm(out, { recursive: true, force: true });
});

describe("astro build with a config error", () => {
  it("exits with code 1", () => {
    expect(code).toBe(1);
  });

  it("logs the glyphcut error once", () => {
    const line = '[glyphcut] Fontsource package for "no-such-font" not found';
    expect(output.split(line)).toHaveLength(2);
  });
});
