# Security Policy

## What AICEK does to your machine

AICEK is built **read-only first**. The flagship command, `aicek doctor`, makes
**zero writes** — it reads your project's configuration, computes a health score
locally, and prints the result. Nothing leaves your machine.

### Data handling

- **No telemetry.** AICEK does not phone home, collect analytics, or transmit
  your files, scores, or paths anywhere.
- **Local only.** All analysis runs on your machine. No account, no API key, no
  network call is required to run `aicek doctor`.
- **No secrets read on purpose.** AICEK inspects agent-configuration files
  (`CLAUDE.md`, `.claude/`, ignore files, manifests). It does not scan for or
  exfiltrate credentials. Files matched by your ignore config are skipped.

### Commands that write (and only with your consent)

| Command | Writes? | Guarantee |
|---|---|---|
| `aicek doctor` | **No** | Asserted by tests — zero file writes. |
| `aicek init` | Yes | Only after an explicit confirmation prompt. `--dry-run` previews. |
| `aicek optimize` | Yes | Only after confirmation; changes are archived and reversible via `aicek restore`. |

`--dry-run` is available on every writing command and `--yes` is required to
write non-interactively (CI).

## Supported versions

AICEK is pre-1.0. Security fixes land on the latest published version only.

## Reporting a vulnerability

Please report suspected vulnerabilities privately via a
[GitHub Security Advisory](https://github.com/HemVaria/aicek/security/advisories/new)
or by opening a minimal issue that does **not** include sensitive details and
asking for a private channel. We aim to acknowledge within 7 days.
