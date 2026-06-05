import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLabels, buildSubject, getConfigRef, hasReportComment, removeLabels, upsertComment } from "../src/github-client.js";

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

  it("builds issue subjects and skips duplicate search for short titles", async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn()
        }
      }
    };

    const subject = await buildSubject(octokit as never, issueContext({
      title: "Crash"
    }), 8);

    expect(subject?.kind).toBe("issue");
    if (subject?.kind === "issue") {
      expect(subject.duplicateCandidates).toEqual([]);
    }
    expect(octokit.rest.search.issuesAndPullRequests).not.toHaveBeenCalled();
  });

  it("returns null for unsupported events and issue events that actually reference pull requests", async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn()
        }
      }
    };

    await expect(buildSubject(octokit as never, {
      eventName: "push",
      repo: { owner: "octo", repo: "repo" },
      payload: {}
    } as never, 8)).resolves.toBeNull();
    await expect(buildSubject(octokit as never, issueContext({
      pull_request: {}
    }), 8)).resolves.toBeNull();
  });

  it("normalizes issue labels and missing authors from GitHub payloads", async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn()
        }
      }
    };

    const subject = await buildSubject(octokit as never, issueContext({
      labels: ["bug", { name: "needs-info" }, {}],
      user: null
    }), 0);

    expect(subject?.kind).toBe("issue");
    if (subject?.kind === "issue") {
      expect(subject.labels).toEqual(["bug", "needs-info"]);
      expect(subject.author).toBe("unknown");
    }
  });

  it("adds likely duplicate issue candidates for longer titles", async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({
            data: {
              items: [
                {
                  number: 4,
                  title: "Parser crash on startup",
                  html_url: "https://github.com/octo/repo/issues/4"
                }
              ]
            }
          })
        }
      }
    };

    const subject = await buildSubject(octokit as never, issueContext({
      title: "Parser crash startup"
    }), 8);

    expect(subject?.kind).toBe("issue");
    if (subject?.kind === "issue") {
      expect(subject.duplicateCandidates[0]).toMatchObject({
        number: 4,
        title: "Parser crash on startup"
      });
    }
  });

  it("warns and continues when duplicate issue search fails", async () => {
    const warnings: string[] = [];
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockRejectedValue(new Error("search down"))
        }
      }
    };

    const subject = await buildSubject(octokit as never, issueContext({
      title: "Parser crash startup"
    }), 8, (warning) => warnings.push(warning));

    expect(subject?.kind).toBe("issue");
    if (subject?.kind === "issue") {
      expect(subject.duplicateCandidates).toEqual([]);
    }
    expect(warnings).toEqual(["Duplicate issue search failed: search down"]);
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

  it("skips empty label writes", async () => {
    const octokit = {
      rest: {
        issues: {
          getLabel: vi.fn(),
          createLabel: vi.fn(),
          addLabels: vi.fn()
        }
      }
    };

    await applyLabels(octokit as never, "octo", "repo", 42, ["", ""], true);

    expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
    expect(octokit.rest.issues.getLabel).not.toHaveBeenCalled();
  });

  it("creates missing managed labels with deterministic colors", async () => {
    const octokit = {
      rest: {
        issues: {
          getLabel: vi.fn().mockRejectedValue({ status: 404 }),
          createLabel: vi.fn().mockResolvedValue({}),
          addLabels: vi.fn().mockResolvedValue({})
        }
      }
    };

    await applyLabels(octokit as never, "octo", "repo", 42, [
      "security-review",
      "needs-tests",
      "possible-duplicate",
      "large-scope"
    ], true);

    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith(expect.objectContaining({
      name: "security-review",
      color: "b60205"
    }));
    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith(expect.objectContaining({
      name: "needs-tests",
      color: "d4c5f9"
    }));
    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith(expect.objectContaining({
      name: "possible-duplicate",
      color: "cfd3d7"
    }));
    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith(expect.objectContaining({
      name: "large-scope",
      color: "fbca04"
    }));
  });
});

describe("hasReportComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a managed report comment already exists", async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({
            data: [
              {
                id: 10,
                body: "<!-- maintainer-firewall:report -->\n## Maintainer Firewall report"
              }
            ]
          })
        }
      }
    };

    await expect(hasReportComment(octokit as never, "octo", "repo", 42)).resolves.toBe(true);
    expect(octokit.rest.issues.listComments).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      issue_number: 42,
      per_page: 100,
      page: 1
    });
  });

  it("stops scanning comments as soon as a managed report is found", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      body: index === 9 ? "<!-- maintainer-firewall:report -->" : "ordinary comment"
    }));
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({
            data: firstPage
          })
        }
      }
    };

    await expect(hasReportComment(octokit as never, "octo", "repo", 42)).resolves.toBe(true);
    expect(octokit.rest.issues.listComments).toHaveBeenCalledTimes(1);
  });

  it("continues when existing report comments cannot be listed", async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockRejectedValue(new Error("Resource not accessible by integration"))
        }
      }
    };

    await expect(hasReportComment(octokit as never, "octo", "repo", 42)).resolves.toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      "Could not check for an existing Maintainer Firewall report on #42: Resource not accessible by integration."
    );
  });

  it("scans additional comment pages only when needed", async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn()
            .mockResolvedValueOnce({
              data: Array.from({ length: 100 }, (_, index) => ({
                id: index + 1,
                body: "ordinary comment"
              }))
            })
            .mockResolvedValueOnce({
              data: [
                {
                  id: 101,
                  body: "<!-- maintainer-firewall:report -->"
                }
              ]
            })
        }
      }
    };

    await expect(hasReportComment(octokit as never, "octo", "repo", 42)).resolves.toBe(true);
    expect(octokit.rest.issues.listComments).toHaveBeenNthCalledWith(2, {
      owner: "octo",
      repo: "repo",
      issue_number: 42,
      per_page: 100,
      page: 2
    });
  });
});

describe("issue comment and label operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates an existing managed report comment", async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({
            data: [
              {
                id: 99,
                body: "<!-- maintainer-firewall:report -->"
              }
            ]
          }),
          updateComment: vi.fn().mockResolvedValue({}),
          createComment: vi.fn()
        }
      }
    };

    await upsertComment(octokit as never, "octo", "repo", 42, "new body", true);

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      comment_id: 99,
      body: "new body"
    });
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("creates a new report comment when no managed report exists", async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({
            data: []
          }),
          updateComment: vi.fn(),
          createComment: vi.fn().mockResolvedValue({})
        }
      }
    };

    await upsertComment(octokit as never, "octo", "repo", 42, "new body", true);

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      issue_number: 42,
      body: "new body"
    });
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  it("creates comments directly when existing report updates are disabled", async () => {
    const octokit = {
      rest: {
        issues: {
          listComments: vi.fn(),
          createComment: vi.fn().mockResolvedValue({})
        }
      }
    };

    await upsertComment(octokit as never, "octo", "repo", 42, "new body", false);

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      issue_number: 42,
      body: "new body"
    });
    expect(octokit.rest.issues.listComments).not.toHaveBeenCalled();
  });

  it("ignores missing labels when removing stale managed labels", async () => {
    const octokit = {
      rest: {
        issues: {
          removeLabel: vi.fn().mockRejectedValue({ status: 404 })
        }
      }
    };

    await expect(removeLabels(octokit as never, "octo", "repo", 42, ["needs-info"])).resolves.toBeUndefined();
  });

  it("throws non-404 label removal errors", async () => {
    const octokit = {
      rest: {
        issues: {
          removeLabel: vi.fn().mockRejectedValue({ status: 403 })
        }
      }
    };

    await expect(removeLabels(octokit as never, "octo", "repo", 42, ["needs-info"])).rejects.toEqual({ status: 403 });
  });
});

describe("getConfigRef", () => {
  it("uses the pull request base sha when available", () => {
    expect(getConfigRef(pullRequestContext())).toBe("base-sha");
  });

  it("normalizes branch and tag refs", () => {
    expect(getConfigRef({
      eventName: "push",
      ref: "refs/heads/main",
      repo: { owner: "octo", repo: "repo" },
      payload: {}
    } as never)).toBe("main");
    expect(getConfigRef({
      eventName: "push",
      ref: "refs/tags/v0.7.0",
      repo: { owner: "octo", repo: "repo" },
      payload: {}
    } as never)).toBe("v0.7.0");
  });

  it("returns undefined when no ref is available", () => {
    expect(getConfigRef({
      eventName: "workflow_dispatch",
      repo: { owner: "octo", repo: "repo" },
      payload: {}
    } as never)).toBeUndefined();
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

function issueContext(overrides: Partial<{
  title: string;
  body: string;
  labels: unknown[];
  pull_request: unknown;
  user: { login?: string } | null;
}> = {}) {
  return {
    eventName: "issues",
    repo: {
      owner: "octo",
      repo: "repo"
    },
    ref: "refs/heads/main",
    payload: {
      issue: {
        number: 7,
        title: overrides.title ?? "Parser crash startup",
        body: overrides.body ?? "Version 1.2.3 crashes after running the reproduction command.",
        html_url: "https://github.com/octo/repo/issues/7",
        labels: overrides.labels ?? [],
        ...(overrides.pull_request === undefined ? {} : { pull_request: overrides.pull_request }),
        ...(overrides.user === null ? {} : { user: overrides.user ?? { login: "reporter" } })
      }
    }
  } as never;
}
