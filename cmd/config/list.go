package config

import (
	"fmt"
	"strings"

	"github.com/quickcli/quick/internal/app"
	"github.com/spf13/cobra"
)

var ListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all configs",
	RunE: func(cmd *cobra.Command, args []string) error {
		api, err := app.New()
		if err != nil {
			return err
		}
		configs := api.ListConfigs()
		if len(configs) == 0 {
			fmt.Println("No configs yet. Run `quick config add` to create one.")
			return nil
		}

		active := api.ActiveConfig()
		fmt.Printf("%-20s %-18s %s\n", "NAME", "SCOPE", "DISPLAY NAME")
		fmt.Println(strings.Repeat("─", 60))
		for _, c := range configs {
			scope := strings.Join(c.Scope, ",")
			marker := ""
			if c.Name == active {
				marker = " ✓"
			}
			name := c.DisplayName
			if name == "" {
				name = c.Name
			}
			fmt.Printf("%-20s %-18s %s%s\n", c.Name, scope, name, marker)
		}
		return nil
	},
}
