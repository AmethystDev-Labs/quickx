package templatecmd

import (
	"fmt"
	"strings"

	"github.com/quickcli/quick/internal/template"
	"github.com/spf13/cobra"
)

var ListCmd = &cobra.Command{
	Use:   "list",
	Short: "List available provider templates from the registry",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("Fetching templates from registry…")
		templates, err := template.FetchAll()
		if err != nil {
			return fmt.Errorf("could not fetch templates: %w\nCheck your internet connection.", err)
		}
		if len(templates) == 0 {
			fmt.Println("No templates found in the registry.")
			return nil
		}
		fmt.Printf("\n%-20s %-30s %s\n", "ID", "NAME", "SCOPE")
		fmt.Println(strings.Repeat("─", 60))
		for _, t := range templates {
			fmt.Printf("%-20s %-30s %s\n", t.ID, t.DisplayName, strings.Join(t.Scope, ","))
		}
		fmt.Printf("\nUse `quick provider add --from-template <id>` to create a provider.\n")
		return nil
	},
}
