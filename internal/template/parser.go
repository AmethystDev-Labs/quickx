package template

import (
	"regexp"
	"strings"
)

// Placeholder represents a parsed ${--:"question":"default"} token.
type Placeholder struct {
	full     string // the entire ${...} expression
	question string
	defVal   string
}

// Question returns the user-facing question text.
func (p Placeholder) Question() string { return p.question }

// Default returns the default value (may be empty).
func (p Placeholder) Default() string { return p.defVal }

// Full returns the original ${...} expression.
func (p Placeholder) Full() string { return p.full }

// magicRe matches ${--:"<question>":"<default>"} with an optional default.
var magicRe = regexp.MustCompile(`\$\{--:"([^"]+)"(?::"([^"]*)")?\}`)

// FindPlaceholders returns all distinct magic placeholders found in s.
func FindPlaceholders(s string) []Placeholder {
	matches := magicRe.FindAllStringSubmatch(s, -1)
	seen := map[string]bool{}
	var out []Placeholder
	for _, m := range matches {
		if seen[m[0]] {
			continue
		}
		seen[m[0]] = true
		out = append(out, Placeholder{
			full:     m[0],
			question: m[1],
			defVal:   m[2],
		})
	}
	return out
}

// Substitute replaces all magic placeholders in s with the corresponding
// answer from the answers map (keyed by question text).
func Substitute(s string, answers map[string]string) string {
	return magicRe.ReplaceAllStringFunc(s, func(match string) string {
		sub := magicRe.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		if ans, ok := answers[sub[1]]; ok {
			return ans
		}
		// Fall back to default if provided.
		if len(sub) >= 3 && sub[2] != "" {
			return sub[2]
		}
		return ""
	})
}

// HasPlaceholders reports whether s contains any magic syntax.
func HasPlaceholders(s string) bool {
	return strings.Contains(s, "${--:")
}
