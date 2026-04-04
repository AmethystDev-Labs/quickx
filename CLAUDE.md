# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn build          # Compile with tsup → dist/
yarn check          # TypeScript type-check (no emit)
yarn dev            # Run from source with tsx (no build step)
node dist/index.js  # Run compiled output directly
```

There are no tests. Publishing is tag-driven: push a `v*` tag and GitHub Actions publishes to npm.

## Architecture

`quickx` is a Codex-only profile manager. It has two interaction surfaces sharing one API class:

- **Commander CLI** (`src/index.tsx`) — `quickx config add/edit/remove/list/login`, `quickx use`, `quickx status`, `quickx templates`
- **Ink TUI** (`src/tui.tsx` + `src/components/App.tsx`) — launched when no CLI args are given

### Core data flow

```
QuickxApi (src/api.ts)
  ├── lib/store.ts     → reads/writes ~/.config/quickx/config.json (quickx's own store)
  ├── lib/codex.ts     → writes ~/.codex/config.toml and ~/.codex/auth.json (Codex config)
  ├── lib/auth.ts      → reads Codex auth state (email, tokens)
  ├── lib/login.ts     → browser PKCE and device-code OAuth flows
  ├── lib/templates.ts → fetches/caches provider templates from AmethystDev-Labs/QuickCLI on GitHub
  ├── lib/prompts.ts   → interactive CLI prompts (readline)
  ├── lib/print.ts     → formatted terminal output
  ├── lib/paths.ts     → platform-aware config/data paths
  └── lib/utils.ts     → helpers (openBrowser, sanitizeEmail, cloneProfiles)
```

`QuickxApi` is the single source of truth. It reloads from disk on every mutating call to avoid stale state. The CLI and TUI both instantiate one `QuickxApi` and call its methods directly — there is no HTTP layer between them.

### Template system

Templates live in `AmethystDev-Labs/QuickCLI` on GitHub (fetched via GitHub API) and are merged with hardcoded `builtinTemplates` in `src/lib/templates.ts`. Dynamic fields use the magic syntax `${--:"Question text":"default"}` which is scanned by a regex (`MAGIC_RE`) and substituted interactively. Remote templates are cached for 1 hour in `~/.config/quickx/template-cache/`.

### Codex config writing

`applyCodexProfile` in `src/lib/codex.ts` rewrites `~/.codex/config.toml` on every `quickx use`. It preserves non-`[model_providers.*]` TOML sections from the existing file and regenerates the `[model_providers.*]` blocks from all saved profiles, setting the active one at the top level. API key mode also updates `~/.codex/auth.json` via `lib/auth.ts`.

### Build

`tsup` bundles `src/index.tsx` → `dist/index.js` as a single ESM file with `#!/usr/bin/env node` prepended. No separate shebang step needed.
