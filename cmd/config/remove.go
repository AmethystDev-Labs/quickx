package config

import (
	"fmt"

	"github.com/quickcli/quick/internal/app"
	"github.com/spf13/cobra"
)

var RemoveCmd = &cobra.Command{
	Use:     "remove <name>",
	Aliases: []string{"rm", "delete"},
	Short:   "Remove a config",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		api, err := app.New()
		if err != nil {
			return err
		}
		if err := api.RemoveConfig(args[0]); err != nil {
			return err
		}
		fmt.Printf("Config %q removed.\n", args[0])
		return nil
	},
}
