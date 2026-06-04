import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { getSkipReason } from "../src/ignore.js";
import type { PullRequestSubject } from "../src/types.js";

const subject: PullRequestSubject = {
  kind: "pull_request",
  number: 7,
  title: "Bump dependency",
  body: "Automated dependency update.",
  author: "dependabot[bot]",
  labels: [],
  htmlUrl: "https://github.com/example/repo/pull/7",
  draft: false,
  baseRef: "main",
  headRef: "dependabot/npm/pkg",
  changedFiles: []
};

describe("getSkipReason", () => {
  it("skips known automation authors by default", () => {
    expect(getSkipReason(subject, defaultConfig)).toContain("dependabot[bot]");
  });

  it("skips the configured skip label by default", () => {
    expect(getSkipReason({
      ...subject,
      author: "contributor",
      labels: ["skip-firewall"]
    }, defaultConfig)).toContain("skip-firewall");
  });

  it("ignores unsafe title regex patterns", () => {
    expect(getSkipReason({
      ...subject,
      author: "contributor",
      title: "aaaaaaaaaaaaaaaaaaaa"
    }, {
      ...defaultConfig,
      ignore: {
        ...defaultConfig.ignore,
        titlePatterns: [unsafeNestedQuantifierPattern()]
      }
    })).toBeNull();
  });
});

function unsafeNestedQuantifierPattern(): string {
  return ["(", "a", "+", ")", "+", "$"].join("");
}
