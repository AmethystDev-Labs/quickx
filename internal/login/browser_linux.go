//go:build linux

package login

import "os/exec"

func openBrowserPlatform(rawURL string) error {
	return exec.Command("xdg-open", rawURL).Start()
}
