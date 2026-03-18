package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// confirmScreen is a simple yes/no dialog pushed on the stack.
// onYes is returned as the Cmd when the user confirms.
type confirmScreen struct {
	question string
	onYes    tea.Cmd
	cursor   int // 0 = Yes, 1 = No
	width    int
}

func newConfirmScreen(question string, onYes tea.Cmd) *confirmScreen {
	return &confirmScreen{question: question, onYes: onYes}
}

func (m *confirmScreen) Init() tea.Cmd { return nil }

func (m *confirmScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
	case ScreenFocusedMsg:
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc", "q", "n":
			return m, Pop()
		case "y":
			return m, m.onYes
		case "left", "h", "right", "l", "tab":
			m.cursor = 1 - m.cursor
		case "enter", " ":
			if m.cursor == 0 {
				return m, m.onYes
			}
			return m, Pop()
		}
	}
	return m, nil
}

func (m *confirmScreen) View() string {
	var sb strings.Builder
	sb.WriteString(styleError.Render(m.question) + "\n\n")

	yes := "  Yes  "
	no := "  No   "
	if m.cursor == 0 {
		yes = styleSelected.Render("[ Yes ]")
		no = "  No   "
	} else {
		yes = "  Yes  "
		no = styleSelected.Render("[ No  ]")
	}
	sb.WriteString(yes + "    " + no + "\n\n")
	sb.WriteString(hint("←/→ choose  enter confirm  esc cancel"))

	w := 36
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}
