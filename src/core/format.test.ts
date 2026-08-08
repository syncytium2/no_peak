import { describe, expect, test } from "vitest";
import { fmt } from "./format";

describe("fmt", () => {
  test("non-finite renders as em dash", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
    expect(fmt(NaN)).toBe("—");
  });

  test("keeps values at or under 3 significant digits", () => {
    expect(fmt(0.68)).toBe("0.68");
    expect(fmt(0.169)).toBe("0.169");
    expect(fmt(4)).toBe("4");
    expect(fmt(15.3)).toBe("15.3");
  });

  test("clamps values over 3 significant digits to one decimal", () => {
    expect(fmt(15.279)).toBe("15.3");
    expect(fmt(4.938)).toBe("4.9");
    expect(fmt(6.159)).toBe("6.2");
    expect(fmt(4.518)).toBe("4.5");
    expect(fmt(-4.938)).toBe("-4.9");
  });
});
