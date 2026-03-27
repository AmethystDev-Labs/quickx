package config

import (
	"errors"
	"fmt"
	"os"

	"github.com/quickcli/quick/pkg/xdg"
	"gopkg.in/yaml.v3"
)

// Store is the top-level QuickCLI configuration stored in config.yaml.
type Store struct {
	ActiveConfig string   `yaml:"active_config"`
	Configs      []Config `yaml:"configs"`
}

// Load reads config.yaml from the XDG config directory.
// If the file does not exist, an empty Store is returned without error.
func Load() (*Store, error) {
	path := xdg.ConfigFile()
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &Store{}, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}
	var s Store
	if err := yaml.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return &s, nil
}

// Save writes the Store to config.yaml, creating the directory if needed.
func (s *Store) Save() error {
	if err := xdg.EnsureConfigDir(); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := yaml.Marshal(s)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(xdg.ConfigFile(), data, 0o600); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}

// --- Config CRUD ---

// Get returns the config with the given name, or nil.
func (s *Store) Get(name string) *Config {
	for i := range s.Configs {
		if s.Configs[i].Name == name {
			return &s.Configs[i]
		}
	}
	return nil
}

// Add appends c; returns error if a config with the same name exists.
func (s *Store) Add(c Config) error {
	if s.Get(c.Name) != nil {
		return fmt.Errorf("config %q already exists", c.Name)
	}
	s.Configs = append(s.Configs, c)
	return nil
}

// Remove deletes the config with the given name.
func (s *Store) Remove(name string) error {
	for i, c := range s.Configs {
		if c.Name == name {
			s.Configs = append(s.Configs[:i], s.Configs[i+1:]...)
			if s.ActiveConfig == name {
				s.ActiveConfig = ""
			}
			return nil
		}
	}
	return fmt.Errorf("config %q not found", name)
}

// Update replaces an existing config with the same name.
func (s *Store) Update(c Config) error {
	for i := range s.Configs {
		if s.Configs[i].Name == c.Name {
			s.Configs[i] = c
			return nil
		}
	}
	return fmt.Errorf("config %q not found", c.Name)
}

// ForScope returns all configs that apply to the given scope.
func (s *Store) ForScope(scope string) []Config {
	var out []Config
	for _, c := range s.Configs {
		if c.HasScope(scope) {
			out = append(out, c)
		}
	}
	return out
}
