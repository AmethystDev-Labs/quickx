package writer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/quickcli/quick/internal/config"
)

// claudeSettingsPath returns the path to ~/.claude/settings.json.
func claudeSettingsPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "settings.json")
}

// WriteClaudeCode updates ~/.claude/settings.json with the env vars required
// for the given configs that have claudecode scope.
func WriteClaudeCode(configs []config.Config) error {
	path := claudeSettingsPath()

	// Read existing settings (tolerating absence).
	settings := map[string]interface{}{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &settings)
	}

	// Ensure "env" sub-object exists.
	envRaw, _ := settings["env"]
	env, ok := envRaw.(map[string]interface{})
	if !ok {
		env = map[string]interface{}{}
	}

	// Clear previously set quick-managed keys so stale values don't linger.
	delete(env, "ANTHROPIC_BASE_URL")
	delete(env, "ANTHROPIC_AUTH_TOKEN")
	delete(env, "ANTHROPIC_API_KEY")

	for _, c := range configs {
		if !c.HasClaudeCodeScope() {
			continue
		}
		if c.BaseURL != "" {
			env["ANTHROPIC_BASE_URL"] = c.BaseURL
		}
		if c.APIKey != "" {
			env["ANTHROPIC_AUTH_TOKEN"] = c.APIKey
		}
	}

	settings["env"] = env

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create .claude dir: %w", err)
	}
	data, err := json.MarshalIndent(settings, "", "    ")
	if err != nil {
		return fmt.Errorf("marshal claude settings: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write claude settings: %w", err)
	}
	return nil
}
