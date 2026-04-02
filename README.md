# quickx

`quickx` is a Codex-only profile manager with a Commander CLI and an Ink TUI.

It keeps the existing terminal-first workflow, but the project is now a pure Node.js + TypeScript app. There is no Go core, no native bridge, no platform packages, no Claude Code/OpenCode support, and no template system.

## Install

```bash
yarn install
yarn build
node dist/index.js
```

For global use after publishing:

```bash
npm install -g quickx
```

## What It Does

- Stores Codex profiles in `~/.config/quickx/config.json` on macOS/Linux and `%APPDATA%\\quickx\\config.json` on Windows.
- Writes the active profile into `~/.codex/config.toml`.
- Updates `~/.codex/auth.json` for API-key mode.
- Supports ChatGPT/Codex login via browser PKCE or device code and creates a Codex profile from the authenticated account.

## Commands

```bash
# Launch the Ink TUI
quickx

# Add a profile
quickx config add my-openai \
  --base-url https://api.openai.com/v1 \
  --api-key sk-xxx \
  --model gpt-5

# Log in with Codex / ChatGPT
quickx config login
quickx config login --device

# List profiles
quickx config list

# Edit or remove a profile
quickx config edit my-openai --model gpt-5.1
quickx config remove my-openai

# Activate a profile
quickx use my-openai

# Show current state
quickx status
```

## Profile Fields

- `name`: internal profile key
- `displayName`: human-readable label
- `baseUrl`: Codex provider base URL
- `apiKey`: API key for API-key mode
- `model`: default model
- `wireApi`: `responses` or `chat`
- `authMethod`: `api_key` or `chatgpt`
- `reasoningEffort`: Codex reasoning level
- `modelVerbosity`: optional Codex verbosity override

## Release

Publishing is tag-driven. Push a `v*` tag and GitHub Actions will build the package and publish to npm.
