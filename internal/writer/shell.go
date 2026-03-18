package writer

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/quickcli/quick/internal/config"
)

const (
	blockStart = "# >>> QuickCLI managed block — do not edit manually <<<"
	blockEnd   = "# <<< QuickCLI managed block end >>>"
)

// WriteShellEnv writes (or replaces) a QuickCLI-managed env-var block in the
// user's shell profile. On Windows the block is written to PowerShell's
// $PROFILE. On Unix it targets ~/.zshrc if present, otherwise ~/.bashrc.
func WriteShellEnv(configs []config.Config) error {
	if runtime.GOOS == "windows" {
		return writeWindowsProfile(configs)
	}
	return writeUnixProfile(configs)
}

// --- Unix ---

func writeUnixProfile(configs []config.Config) error {
	profile := unixProfilePath()
	return writeBlock(profile, buildUnixBlock(configs))
}

func unixProfilePath() string {
	home, _ := os.UserHomeDir()
	zshrc := filepath.Join(home, ".zshrc")
	if _, err := os.Stat(zshrc); err == nil {
		return zshrc
	}
	return filepath.Join(home, ".bashrc")
}

func buildUnixBlock(configs []config.Config) string {
	var lines []string
	for _, c := range configs {
		if c.HasClaudeCodeScope() {
			if c.BaseURL != "" {
				lines = append(lines, fmt.Sprintf("export ANTHROPIC_BASE_URL=%q", c.BaseURL))
			}
			if c.APIKey != "" {
				lines = append(lines, fmt.Sprintf("export ANTHROPIC_AUTH_TOKEN=%q", c.APIKey))
			}
		}
		if c.HasCodexScope() {
			if c.APIKey != "" {
				lines = append(lines, fmt.Sprintf("export OPENAI_API_KEY=%q", c.APIKey))
			}
		}
	}
	return strings.Join(lines, "\n")
}

// --- Windows PowerShell ---

func writeWindowsProfile(configs []config.Config) error {
	profile := windowsProfilePath()
	if err := os.MkdirAll(filepath.Dir(profile), 0o700); err != nil {
		return err
	}
	return writeBlock(profile, buildPowerShellBlock(configs))
}

func windowsProfilePath() string {
	if p := os.Getenv("PROFILE"); p != "" {
		return p
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1")
}

func buildPowerShellBlock(configs []config.Config) string {
	var lines []string
	for _, c := range configs {
		if c.HasClaudeCodeScope() {
			if c.BaseURL != "" {
				lines = append(lines, fmt.Sprintf(`$env:ANTHROPIC_BASE_URL="%s"`, c.BaseURL))
			}
			if c.APIKey != "" {
				lines = append(lines, fmt.Sprintf(`$env:ANTHROPIC_AUTH_TOKEN="%s"`, c.APIKey))
			}
		}
		if c.HasCodexScope() {
			if c.APIKey != "" {
				lines = append(lines, fmt.Sprintf(`$env:OPENAI_API_KEY="%s"`, c.APIKey))
			}
		}
	}
	return strings.Join(lines, "\n")
}

// --- Generic block writer ---

func writeBlock(profilePath, content string) error {
	existing := ""
	if data, err := os.ReadFile(profilePath); err == nil {
		existing = string(data)
	}

	block := blockStart + "\n" + content + "\n" + blockEnd

	if idx := strings.Index(existing, blockStart); idx >= 0 {
		endIdx := strings.Index(existing, blockEnd)
		if endIdx < 0 {
			endIdx = len(existing)
		} else {
			endIdx += len(blockEnd)
		}
		existing = existing[:idx] + block + existing[endIdx:]
	} else {
		if len(existing) > 0 && !strings.HasSuffix(existing, "\n") {
			existing += "\n"
		}
		existing += "\n" + block + "\n"
	}

	if err := os.MkdirAll(filepath.Dir(profilePath), 0o700); err != nil {
		return err
	}
	return os.WriteFile(profilePath, []byte(existing), 0o644)
}
