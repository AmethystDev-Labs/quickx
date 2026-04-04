# quickx

`quickx` is a Codex profile manager. It lets you store multiple provider configurations and switch between them instantly — no manual editing of `~/.codex/config.toml` required.

## Getting Started

```bash
npm install -g @amethyst-labs/quickx
```

The fastest way to get going is via a provider template:

```bash
# Browse built-in and community templates
quickx templates list

# Preview what a template needs
quickx templates preview openai

# Create a profile from a template (prompts for API key, model, etc.)
quickx profiles add my-openai --from-template openai

# Activate it
quickx use my-openai
```

Or log in with your ChatGPT / Codex account:

```bash
quickx profiles login            # opens browser
quickx profiles login --device   # device-code flow (no browser)
```

## CLI

Run with no arguments to open the [interactive TUI](#tui).

### Profile management

`profiles` is the primary command. `config` is a supported alias.

```bash
quickx profiles list
quickx profiles add <name> [options]
quickx profiles edit <name> [options]
quickx profiles remove <name>
quickx profiles login [name] [--device]
```

**`add` options**

| Flag | Description |
|---|---|
| `--from-template <id>` | Bootstrap fields from a provider template |
| `--base-url <url>` | Provider API base URL |
| `--api-key <key>` | API key |
| `--model <model>` | Default model |
| `--wire-api <api>` | `responses` (default) or `chat` |
| `--auth-method <method>` | `api_key` (default) or `chatgpt` |
| `--reasoning-effort <level>` | Codex reasoning effort |
| `--model-verbosity <level>` | Codex model verbosity |

**`edit`** accepts the same flags; only the flags you supply are changed.

### Activation & status

```bash
quickx use <name>    # write profile to ~/.codex/config.toml
quickx status        # show active profile and all saved profiles
```

### Templates

```bash
quickx templates list              # list all available templates
quickx templates preview <id>      # show fields and dynamic placeholders
```

Templates are fetched from [AmethystDev-Labs/QuickCLI](https://github.com/AmethystDev-Labs/QuickCLI) and merged with built-in presets. Remote templates are cached for 1 hour in `~/.cache/quickx/template-cache/`.

## TUI

Running `quickx` with no arguments launches a full-screen terminal UI built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal).

**Tabs** — switch with `1` / `2` / `3`

| Tab | Contents |
|---|---|
| `Status` | Active profile, file paths, all saved profiles at a glance |
| `Profiles` | Scrollable profile list with a detail panel |
| `Templates` | Scrollable template list with a live preview panel |

**Profiles tab keys**

| Key | Action |
|---|---|
| `↑` / `↓` | Move selection |
| `Enter` or `Ctrl+U` | Activate selected profile |
| `Ctrl+A` | Open Add Profile form |
| `Ctrl+E` | Open Edit Profile form |
| `Ctrl+D` | Confirm-delete selected profile |
| `Ctrl+L` | Open Codex Login form |
| `Ctrl+R` | Refresh |

**Templates tab keys**

| Key | Action |
|---|---|
| `↑` / `↓` | Move selection |
| `Enter` | Open Create Profile form for selected template |
| `Ctrl+R` | Refresh |

**Global keys:** `Ctrl+Q` or `Esc` to quit.

All forms use `↑` / `↓` to move between fields, printable characters to type, `Backspace` to delete, and `Ctrl+S` to submit. `Esc` cancels and returns to browse mode.

## Profile fields

| Field | Description |
|---|---|
| `name` | Internal profile key |
| `displayName` | Human-readable label |
| `baseUrl` | Provider API base URL |
| `apiKey` | API key (api_key auth mode) |
| `model` | Default model |
| `wireApi` | `responses` or `chat` |
| `authMethod` | `api_key` or `chatgpt` |
| `reasoningEffort` | Codex reasoning level |
| `modelVerbosity` | Optional Codex verbosity override |

## Storage

| Path | Purpose |
|---|---|
| `~/.config/quickx/config.json` | quickx profile store (macOS/Linux) |
| `%APPDATA%\quickx\config.json` | quickx profile store (Windows) |
| `~/.cache/quickx/template-cache/` | Remote template cache (1 h TTL) |
| `~/.codex/config.toml` | Written on every `quickx use` |
| `~/.codex/auth.json` | Updated for ChatGPT auth mode |

## Release

Publishing is tag-driven. Push a `v*` tag and GitHub Actions publishes to npm.
