//go:build windows

package login

import "os/exec"

func openBrowserPlatform(rawURL string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL).Start()
}
