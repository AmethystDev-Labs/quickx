package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/quickcli/quick/internal/app"
)

type clearFlashMsg struct{}

// root is the outermost bubbletea model.
// It owns a stack of screens and a flash notification strip.
// Screens navigate by emitting PushMsg / PopMsg commands; they never call
// tea.NewProgram themselves.
type root struct {
	api      *app.API
	stack    []tea.Model
	width    int
	height   int
	flash    string
	flashErr bool
}

func newRoot(api *app.API) root {
	return root{
		api:   api,
		stack: []tea.Model{newMenuScreen(api)},
	}
}

func (r root) Init() tea.Cmd {
	if len(r.stack) == 0 {
		return nil
	}
	return r.stack[0].Init()
}

func (r root) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		r.width, r.height = msg.Width, msg.Height
		// Propagate size to the current top screen.
		if len(r.stack) > 0 {
			newTop, cmd := r.stack[len(r.stack)-1].Update(msg)
			r.stack[len(r.stack)-1] = newTop
			return r, cmd
		}
		return r, nil

	case PushMsg:
		// Give the new screen the current window size immediately, then init.
		newScreen, sizeCmd := msg.Screen.Update(tea.WindowSizeMsg{Width: r.width, Height: r.height})
		r.stack = append(r.stack, newScreen)
		return r, tea.Batch(newScreen.Init(), sizeCmd)

	case PopMsg:
		if len(r.stack) <= 1 {
			return r, tea.Quit
		}
		r.stack = r.stack[:len(r.stack)-1]
		// Tell the newly exposed screen it's in focus (so it can refresh).
		return r, func() tea.Msg { return ScreenFocusedMsg{} }

	case FlashMsg:
		r.flash = msg.Text
		r.flashErr = msg.IsErr
		return r, tea.Tick(3*time.Second, func(time.Time) tea.Msg {
			return clearFlashMsg{}
		})

	case clearFlashMsg:
		r.flash = ""
		return r, nil
	}

	// Delegate all other messages to the top of the stack.
	if len(r.stack) == 0 {
		return r, tea.Quit
	}
	top := r.stack[len(r.stack)-1]
	newTop, cmd := top.Update(msg)
	r.stack[len(r.stack)-1] = newTop
	return r, cmd
}

func (r root) View() string {
	if len(r.stack) == 0 {
		return ""
	}
	content := r.stack[len(r.stack)-1].View()

	if r.flash != "" {
		var style lipgloss.Style
		if r.flashErr {
			style = lipgloss.NewStyle().Foreground(lipgloss.Color("9"))
		} else {
			style = lipgloss.NewStyle().Foreground(lipgloss.Color("10"))
		}
		content += "\n" + style.Render("  "+r.flash)
	}

	if r.width > 0 && r.height > 0 {
		return lipgloss.Place(r.width, r.height, lipgloss.Center, lipgloss.Center, content)
	}
	return content
}

// Run starts the QuickCLI TUI as a single alt-screen session.
func Run(api *app.API) error {
	p := tea.NewProgram(newRoot(api), tea.WithAltScreen())
	_, err := p.Run()
	return err
}
