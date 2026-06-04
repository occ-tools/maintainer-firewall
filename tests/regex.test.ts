import { describe, expect, it } from "vitest";
import { compileConfigRegex, configuredRegexWarnings, matchesAnyConfiguredRegex, replaceByConfiguredRegexes } from "../src/regex.js";

describe("configured regex helpers", () => {
  it("matches and replaces valid configured regex patterns", () => {
    expect(matchesAnyConfiguredRegex("token sk-abc12345678901234567890", ["\\bsk-[A-Za-z0-9_-]{20,}\\b"])).toBe(true);
    expect(replaceByConfiguredRegexes(
      "token sk-abc12345678901234567890",
      ["\\bsk-[A-Za-z0-9_-]{20,}\\b"],
      "[redacted]"
    )).toBe("token [redacted]");
  });

  it("ignores invalid or potentially unsafe patterns", () => {
    const unsafePattern = unsafeNestedQuantifierPattern();

    expect(compileConfigRegex("[")).toBeNull();
    expect(compileConfigRegex(unsafePattern)).toBeNull();
    expect(matchesAnyConfiguredRegex("aaaaaaaaaaaaaaaa", [unsafePattern])).toBe(false);
  });

  it("emits diagnostics for invalid and unsafe patterns", () => {
    expect(configuredRegexWarnings("security.secretPatterns", ["[", unsafeNestedQuantifierPattern()])).toEqual([
      expect.stringContaining("invalid regular expression"),
      "security.secretPatterns[1] contains a potentially unsafe regular expression and will be ignored."
    ]);
  });
});

function unsafeNestedQuantifierPattern(): string {
  return ["(", "a", "+", ")", "+", "$"].join("");
}
