# quick templates

Community-maintained provider templates for [quick](https://github.com/AmethystDev-Labs/QuickCLI).

## Structure

Each template lives in its own directory named after the template ID:

```
templates/
  <id>/
    template.yaml
```

`quick` fetches templates from this folder via the GitHub API. The `id` field
in `template.yaml` must match the directory name.

## Magic syntax

Template fields support dynamic placeholders that prompt the user at config
creation time:

```
${--:"Question shown to user":"default value"}
```

Leave the default empty `""` if there is no sensible default.  
Mark a field as a secret (masked input) by putting `key` in the question text —
the TUI wizard will automatically mask it.

### Example

```yaml
api_key: '${--:"My Service API Key":""}'
model:   '${--:"Default model":"gpt-4o"}'
base_url: https://api.example.com/v1
```

## Template fields

| Field          | Required | Description                                           |
|----------------|----------|-------------------------------------------------------|
| `id`           | ✓        | Unique identifier, must match directory name          |
| `display_name` | ✓        | Human-readable name shown in the TUI                  |
| `scope`        | ✓        | `[codex]`, `[claudecode]`, or both                    |
| `base_url`     |          | API base URL (may use magic syntax)                   |
| `api_key`      |          | API key (may use magic syntax)                        |
| `model`        |          | Default model name (may use magic syntax)             |
| `wire_api`     |          | Protocol: `responses` (default) or `chat`             |
| `auth_method`  |          | `api_key` (default), `chatgpt`, `aws`, `gcp`, `azure` |
| `docs_url`     |          | Link to provider documentation                        |
| `required_envs`|          | Environment variables the user must set (list)        |

## Contributing

1. Fork this repository
2. Create a directory under `templates/` named after your provider ID  
   (lowercase, hyphens only — no spaces or special characters)
3. Add a `template.yaml` following the format above
4. Open a pull request with a brief description of the provider

### Rules

- `scope` must be accurate — don't add `claudecode` to a Codex-only provider
- Prefer `${--:"...":""}` over hardcoding values that vary per user
- The `api_key` field must use the magic syntax if users supply their own key
- Do not include real API keys or secrets in templates
