package tui

import "github.com/charmbracelet/lipgloss"

var (
	styleTitle    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("12"))
	styleSelected = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("12"))
	styleDim      = lipgloss.NewStyle().Faint(true)
	styleSuccess  = lipgloss.NewStyle().Foreground(lipgloss.Color("10"))
	styleError    = lipgloss.NewStyle().Foreground(lipgloss.Color("9"))
	styleMuted    = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
)

// box wraps content in a rounded border with horizontal padding.
func box(content string, width int) string {
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("8")).
		Padding(0, 1).
		Width(width).
		Render(content)
}

// hint renders the keyboard shortcut footer line.
func hint(s string) string {
	return styleDim.Render(s)
}
