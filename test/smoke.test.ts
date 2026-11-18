import { expect, test } from "vitest";

import * as pkg from "../src/index.ts";

test("index loads", () => {
  expect(pkg).toBeTypeOf("object");
});
