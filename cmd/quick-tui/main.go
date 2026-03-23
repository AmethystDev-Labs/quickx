package main

import (
	"fmt"
	"os"

	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/tui"
)

func main() {
	api, err := app.New()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := tui.Run(api); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
