package config

import (
	"context"
	"fmt"
	"time"

	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/login"
	"github.com/spf13/cobra"
)

var deviceFlag bool

var LoginCmd = &cobra.Command{
	Use:   "login [name]",
	Short: "Log in with ChatGPT (OpenAI Codex) and create a config",
	Long: `Log in to OpenAI via ChatGPT and create a Codex config entry.

By default uses the browser OAuth (PKCE) flow.
Use --device for SSH / headless environments (device-code flow).`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		configName := "codex-chatgpt"
		if len(args) > 0 {
			configName = args[0]
		}
		api, err := app.New()
		if err != nil {
			return err
		}
		if deviceFlag {
			return runDeviceCodeLogin(api, configName)
		}
		return runBrowserLogin(api, configName)
	},
}

func init() {
	LoginCmd.Flags().BoolVar(&deviceFlag, "device", false,
		"Use device-code flow instead of browser (for SSH/headless environments)")
}

func runBrowserLogin(api *app.API, configName string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	fmt.Println("Starting browser login…")
	authURL, wait, err := api.LoginCodexBrowser(ctx)
	if err != nil {
		return err
	}

	fmt.Printf("\nOpening your browser:\n  %s\n\n", authURL)
	_ = login.OpenBrowser(authURL)

	fmt.Println("Waiting for you to complete login in your browser…")
	if err := wait(); err != nil {
		return err
	}

	return finishConfig(api, configName)
}

func runDeviceCodeLogin(api *app.API, configName string) error {
	fmt.Println("Requesting device code…")
	handle, info, err := api.LoginCodexRequestDevice()
	if err != nil {
		return err
	}

	fmt.Printf("\n1. Open this URL in your browser:\n   %s\n", info.VerificationURL)
	fmt.Printf("\n2. Enter this one-time code:\n   %s\n\n", info.UserCode)

	dots := 0
	tickFn := func() {
		dots = (dots + 1) % 4
		fmt.Printf("\r   Waiting%s   ", dotsStr(dots))
	}

	if err := api.LoginCodexCompleteDevice(handle, tickFn); err != nil {
		fmt.Println()
		return err
	}
	fmt.Printf("\r   ✓ Authenticated!          \n\n")

	return finishConfig(api, configName)
}

func finishConfig(api *app.API, configName string) error {
	created, err := api.CreateCodexLoginConfig(configName)
	if err != nil {
		return err
	}
	fmt.Printf("✓ Config %q created.\n", created)
	fmt.Printf("  Run `quick use %s` to activate it.\n", created)
	return nil
}

func dotsStr(n int) string {
	switch n % 4 {
	case 1:
		return "."
	case 2:
		return ".."
	case 3:
		return "..."
	default:
		return ""
	}
}
