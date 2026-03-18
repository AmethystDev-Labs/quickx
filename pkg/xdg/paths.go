package xdg

import (
	"os"
	"path/filepath"
	"runtime"
)

// ConfigHome returns the XDG-compliant config directory for QuickCLI.
// - Linux/macOS: $XDG_CONFIG_HOME/quickcli  (fallback: ~/.config/quickcli)
// - Windows:     %APPDATA%\quickcli
func ConfigHome() string {
	if runtime.GOOS == "windows" {
		base := os.Getenv("APPDATA")
		if base == "" {
			home, _ := os.UserHomeDir()
			base = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(base, "quickcli")
	}

	xdg := os.Getenv("XDG_CONFIG_HOME")
	if xdg != "" {
		return filepath.Join(xdg, "quickcli")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "quickcli")
}

// ConfigFile returns the full path to config.yaml.
func ConfigFile() string {
	return filepath.Join(ConfigHome(), "config.yaml")
}

// EnsureConfigDir creates the config directory if it does not exist.
func EnsureConfigDir() error {
	return os.MkdirAll(ConfigHome(), 0o700)
}
