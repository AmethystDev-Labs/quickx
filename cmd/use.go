package cmd

import (
	"fmt"

	"github.com/quickcli/quick/internal/app"
	"github.com/spf13/cobra"
)

var useCmd = &cobra.Command{
	Use:   "use <config-name>",
	Short: "Activate a config",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		api, err := app.New()
		if err != nil {
			return err
		}
		if err := api.UseConfig(args[0]); err != nil {
			return err
		}
		fmt.Printf("Activated config %q\n", args[0])
		fmt.Println("Restart your shell (or run `source ~/.zshrc`) for environment changes to take effect.")
		return nil
	},
}
