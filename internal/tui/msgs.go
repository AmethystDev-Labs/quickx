package tui

import tea "github.com/charmbracelet/bubbletea"

// --- Navigation messages ---

// PushMsg pushes a new screen onto the navigation stack.
type PushMsg struct{ Screen tea.Model }

// PopMsg removes the top screen. If the stack has one screen, the program exits.
type PopMsg struct{}

// ScreenFocusedMsg is sent to the new top-of-stack after a Pop, so screens
// can refresh their data when they become visible again.
type ScreenFocusedMsg struct{}

// --- Notification messages ---

// FlashMsg shows a timed status line at the bottom of the screen.
type FlashMsg struct {
	Text  string
	IsErr bool
}

// --- Cmd helpers ---

// Push returns a Cmd that navigates to a new screen.
func Push(s tea.Model) tea.Cmd {
	return func() tea.Msg { return PushMsg{Screen: s} }
}

// Pop returns a Cmd that navigates back one screen.
func Pop() tea.Cmd {
	return func() tea.Msg { return PopMsg{} }
}

// FlashOK returns a Cmd that shows a success notification.
func FlashOK(text string) tea.Cmd {
	return func() tea.Msg { return FlashMsg{Text: text, IsErr: false} }
}

// FlashErr returns a Cmd that shows an error notification.
func FlashErr(text string) tea.Cmd {
	return func() tea.Msg { return FlashMsg{Text: text, IsErr: true} }
}
