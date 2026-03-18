package templatecmd

import (
	"fmt"
	"strings"

	"github.com/quickcli/quick/internal/template"
	"github.com/spf13/cobra"
)

var PreviewCmd = &cobra.Command{
	Use:   "preview <id>",
	Short: "Preview a template from the registry",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]
		fmt.Printf("Fetching template %q…\n\n", id)
		tmpl, err := template.FetchByID(id)
		if err != nil {
			return fmt.Errorf("fetch template: %w", err)
		}
		fmt.Printf("ID          : %s\n", tmpl.ID)
		fmt.Printf("Name        : %s\n", tmpl.DisplayName)
		fmt.Printf("Scope       : %s\n", strings.Join(tmpl.Scope, ", "))
		fmt.Printf("Base URL    : %s\n", tmpl.BaseURL)
		fmt.Printf("Model       : %s\n", tmpl.Model)
		fmt.Printf("Wire API    : %s\n", tmpl.WireAPI)
		fmt.Printf("Auth Method : %s\n", tmpl.AuthMethod)
		if tmpl.DocsURL != "" {
			fmt.Printf("Docs        : %s\n", tmpl.DocsURL)
		}
		if len(tmpl.RequiredEnvs) > 0 {
			fmt.Printf("Required Env: %s\n", strings.Join(tmpl.RequiredEnvs, ", "))
		}

		// Show dynamic fields.
		combined := strings.Join([]string{tmpl.APIKey, tmpl.Model, tmpl.BaseURL}, "|")
		placeholders := template.FindPlaceholders(combined)
		if len(placeholders) > 0 {
			fmt.Println("\nDynamic fields (will be prompted during setup):")
			for _, ph := range placeholders {
				def := ph.Default()
				if def == "" {
					def = "(required)"
				}
				fmt.Printf("  - %s  [default: %s]\n", ph.Question(), def)
			}
		}
		return nil
	},
}
