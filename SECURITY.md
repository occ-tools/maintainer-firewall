# Security Policy

Maintainer Firewall helps route security-sensitive reports, but it is not a secret scanner, vulnerability scanner, or replacement for human security review.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability in this project. Use [GitHub private vulnerability reporting](https://github.com/wangjiehu/maintainer-firewall/security/advisories/new) if it is enabled, or contact the maintainers through the security contact listed by the repository owner.

If you believe Maintainer Firewall exposed or mishandled a credential-like value, include:

- The action version or commit SHA
- The workflow event that triggered the run
- Whether `ai.enabled` was true
- A redacted example of the report body or PR body

Do not include live tokens, private keys, or unreleased exploit details in public reports.

## Security Design Notes

- The action never checks out pull request code.
- For pull requests, configuration and guidance are loaded from the base ref.
- Possible credential findings intentionally do not repeat the matched value.
- If a possible credential is detected, AI analysis is skipped for that issue or pull request.
- AI analysis is optional and disabled by default.
- When AI analysis is enabled, only the issue or PR metadata, changed file list, and configured repository guidance are sent to the model.
