import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLabels, buildSubject, hasReportComment } from "../src/github-client.js";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn()
}));

describe("buildSubject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues with pull request body checks when changed files cannot be listed", async () => {
    const octokit = {
      paginate: vi.fn().mockRejectedValue(new Error("Resource not accessible by integration")),
      rest: {
        pulls: {
          listFiles: vi.fn()
        }
      }
    };

    const subject = await buildSubject(octokit as never, pullRequestContext(), 0);

    expect(subject?.kind).toBe("pull_request");
    if (subject?.kind === "pull_request") {
      expect(subject.changedFiles).toEqual([]);
    }
    expect(core.warning).toHaveBeenCalledWith(
      "Could not list files for pull request #42: Resource not accessible by integration. Continuing with title and body checks only."
    );
  });

  it("maps changed files from pull request payloads", async () => {
    const octokit = {
      paginate: vi.fn().mockResolvedValue([
        {
          filename: "src/index.ts",
          status: "modified",
          additions: 12,
          deletions: 3,
          changes: 15
        }
      ]),
      rest: {
        pulls: {
          listFiles: vi.fn()
        }
      }
    };

    const subject = await buildSubject(octokit as never, pullRequestContext(), 0);

    expect(octokit.paginate).toHaveBeenCalledWith(octokit.rest.pulls.listFiles, {
      owner: "octo",
      repo: "repo",
      pull_number: 42,
      per_page: 100
    });
    expect(subject?.kind).toBe("pull_request");
    if (subject?.kind === "pull_request") {
      expect(subject.changedFiles).toEqual([
        {
          filename: "src/index.ts",
          status: "modified",
          additions: 12,
          deletions: 3,
          changes: 15
        }
      ]);
    }
  });
});

describe("applyLabels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues when another run creates a missing label first", async () => {
    const octokit = {
      rest: {
        issues: {
          getLabel: vi.fn().mockRejectedValue({ status: 404 }),
          createLabel: vi.fn().mockRejectedValue({ status: 422 }),
          addLabels: vi.fn().mockResolvedValue({})
        }
      }
    };

    await applyLabels(octokit as never, "octo", "repo", 42, ["needs-info"], true);

    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      name: "needs-info",
      color: "ededed",
      description: "Managed by Maintainer Firewall"
    });
    expect(core.info).toHaveBeenCalledWith('Label "needs-info" already exists after a concurrent create attempt.');
    expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      issue_number: 42,
      labels: ["needs-info"]
    });
  });
});

describe("hasReportComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a managed report comment already exists", async () => {
    const octokit = {
      paginate: vi.fn().mockResolvedValue([
        {
          id: 10,
          body: "<!-- maintainer-firewall:report -->\n## Maintainer Firewall report"
        }
      ]),
      rest: {
        issues: {
          listComments: vi.fn()
        }
      }
    };

    await expect(hasReportComment(octokit as never, "octo", "repo", 42)).resolves.toBe(true);
    expect(octokit.paginate).toHaveBeenCalledWith(octokit.rest.issues.listComments, {
      owner: "octo",
      repo: "repo",
      issue_number: 42,
      per_page: 100
    });
  });

  it("continues when existing report comments cannot be listed", async () => {
    const octokit = {
      paginate: vi.fn().mockRejectedValue(new Error("Resource not accessible by integration")),
      rest: {
        issues: {
          listComments: vi.fn()
        }
      }
    };

    await expect(hasReportComment(octokit as never, "octo", "repo", 42)).resolves.toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      "Could not check for an existing Maintainer Firewall report on #42: Resource not accessible by integration."
    );
  });
});

function pullRequestContext() {
  return {
    eventName: "pull_request_target",
    repo: {
      owner: "octo",
      repo: "repo"
    },
    ref: "refs/heads/main",
    payload: {
      pull_request: {
        number: 42,
        title: "Improve docs",
        body: "This change improves documentation.",
        html_url: "https://github.com/octo/repo/pull/42",
        draft: false,
        labels: [
          { name: "documentation" }
        ],
        user: {
          login: "contributor"
        },
        base: {
          ref: "main",
          sha: "base-sha"
        },
        head: {
          ref: "feature"
        }
      }
    }
  } as never;
}
