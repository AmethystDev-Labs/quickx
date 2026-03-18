package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/quickcli/quick/internal/app"
)

type menuItem struct {
	label  string
	action func() tea.Cmd
}

type menuScreen struct {
	items  []menuItem
	cursor int
	width  int
}

func newMenuScreen(api *app.API) *menuScreen {
	m := &menuScreen{}
	m.items = []menuItem{
		{"Use a Config", func() tea.Cmd { return Push(newConfigListScreen(api, true)) }},
		{"Login with ChatGPT (Codex)", func() tea.Cmd { return Push(newLoginMethodScreen(api, "")) }},
		{"Manage Configs", func() tea.Cmd { return Push(newConfigListScreen(api, false)) }},
		{"Browse Templates", func() tea.Cmd { return Push(newTemplateListScreen(api)) }},
		{"View Status", func() tea.Cmd { return Push(newStatusScreen(api)) }},
		{"Exit", func() tea.Cmd { return Pop() }},
	}
	return m
}

func (m *menuScreen) Init() tea.Cmd { return nil }

func (m *menuScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
	case ScreenFocusedMsg:
		// nothing to refresh on the main menu
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, Pop()
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.items)-1 {
				m.cursor++
			}
		case "enter", " ":
			return m, m.items[m.cursor].action()
		}
	}
	return m, nil
}

func (m *menuScreen) View() string {
	var sb strings.Builder
	sb.WriteString(styleTitle.Render("quick") + "\n\n")
	for i, item := range m.items {
		if i == m.cursor {
			sb.WriteString(styleSelected.Render("> "+item.label) + "\n")
		} else {
			sb.WriteString("  " + item.label + "\n")
		}
	}
	sb.WriteString("\n" + hint("↑/↓  enter  q quit"))

	w := 34
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}
