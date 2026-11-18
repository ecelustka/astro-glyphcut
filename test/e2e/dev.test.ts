import { fileURLToPath } from "node:url";

import { dev } from "astro";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const fixture = fileURLToPath(new URL("../fixtures/basic/", import.meta.url));
let server: Awaited<ReturnType<typeof dev>> | undefined;
let base = "";
const vitestFlag = process.env["VITEST"];

beforeAll(async () => {
  // Astro skips its dev middleware when VITEST is set. Hide the flag while the server runs.
  delete process.env["VITEST"];
  try {
    server = await dev({ root: fixture, logLevel: "error", server: { port: 0 } });
    base = `http://localhost:${server.address.port}`;
  } finally {
    if (vitestFlag !== undefined) process.env["VITEST"] = vitestFlag;
  }
});

afterAll(async () => {
  await server?.stop();
});

describe("astro dev with glyphcut", () => {
  it("serves a woff2 file", async () => {
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    const url = /url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/.exec(html)?.[1];
    expect(url).toBeDefined();
    const font = await fetch(new URL(url ?? "", base));
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toContain("font/woff2");
  });
});
