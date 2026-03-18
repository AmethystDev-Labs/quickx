//go:build darwin

package login

import "os/exec"

func openBrowserPlatform(rawURL string) error {
	return exec.Command("open", rawURL).Start()
}
