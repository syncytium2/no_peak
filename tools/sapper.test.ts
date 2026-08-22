// Sapper wired into the normal suite: every rule proves it can fire, and the
// tracked tree is clear of BLOCK findings — so `npm test` enforces the rules
// even for a session that never enabled the pre-commit hook.
//
// This is the half of the wiring that cannot be skipped. The hook is opt-in
// (`git config core.hooksPath .githooks`) and a fresh clone does not have it;
// the suite runs everywhere. Same reasoning as tools/fortran's oracle: a gate
// nobody is obliged to run is a gate that reports on the machines that least
// need it.

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const sapper = (mode: string) => {
  try {
    return { code: 0, out: execFileSync("python3", ["tools/sapper.py", mode], { encoding: "utf8" }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
};

describe("sapper", () => {
  // "A check that cannot fire is worse than no check, because it manufactures
  // exactly the confidence it was built to earn." The heredoc gate failed open
  // in seven repositories on precisely this, so the selftest is not optional
  // ceremony — it is the reason to trust a green scan.
  it("every rule can still fire, and stays silent on its good fixture", () => {
    const r = sapper("--selftest");
    expect(r.out).toContain("0 failures");
    expect(r.code).toBe(0);
  });

  it("the tracked tree is clear of BLOCK findings", () => {
    const r = sapper("--all");
    expect(r.out.trim()).toBe("sapper: clear");
    expect(r.code).toBe(0);
  });
});
