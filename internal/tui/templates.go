package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/quickcli/quick/internal/app"
	tmplpkg "github.com/quickcli/quick/internal/template"
)

type templatesFetchedMsg struct {
	items []tmplpkg.Template
	err   error
}

type templateListScreen struct {
	api     *app.API
	items   []tmplpkg.Template
	cursor  int
	loading bool
	err     string
	spinner spinner.Model
	width   int
}

func newTemplateListScreen(api *app.API) *templateListScreen {
	s := spinner.New()
	s.Spinner = spinner.Dot
	return &templateListScreen{api: api, loading: true, spinner: s}
}

func (m *templateListScreen) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		func() tea.Msg {
			items, err := m.api.FetchTemplates()
			return templatesFetchedMsg{items, err}
		},
	)
}

func (m *templateListScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width

	case ScreenFocusedMsg:
		// Re-fetch (will hit cache if recent).
		m.loading = true
		m.err = ""
		return m, tea.Batch(m.spinner.Tick, func() tea.Msg {
			items, err := m.api.FetchTemplates()
			return templatesFetchedMsg{items, err}
		})

	case templatesFetchedMsg:
		m.loading = false
		if msg.err != nil {
			m.err = msg.err.Error()
		} else {
			m.items = msg.items
		}
		return m, nil

	case spinner.TickMsg:
		if m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case tea.KeyMsg:
		if m.loading {
			if msg.String() == "ctrl+c" || msg.String() == "q" || msg.String() == "esc" {
				return m, Pop()
			}
			return m, nil
		}
		switch msg.String() {
		case "ctrl+c", "q", "esc":
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
			if len(m.items) > 0 {
				tmpl := m.items[m.cursor]
				return m, Push(newConfigAddScreen(m.api, &tmpl))
			}
		}
	}
	return m, nil
}

func (m *templateListScreen) View() string {
	var sb strings.Builder
	sb.WriteString(styleTitle.Render("Browse Templates") + "\n\n")

	if m.loading {
		sb.WriteString(m.spinner.View() + "  Fetching templates…\n\n")
		sb.WriteString(hint("q back"))
		w := 40
		if m.width > 0 && m.width < w+4 {
			w = m.width - 4
		}
		return box(sb.String(), w)
	}

	if m.err != "" {
		sb.WriteString(styleError.Render("Error: "+m.err) + "\n\n")
		sb.WriteString(hint("q back"))
		w := 48
		if m.width > 0 && m.width < w+4 {
			w = m.width - 4
		}
		return box(sb.String(), w)
	}

	if len(m.items) == 0 {
		sb.WriteString(styleDim.Render("No templates found.") + "\n\n")
		sb.WriteString(hint("q back"))
		w := 36
		return box(sb.String(), w)
	}

	for i, t := range m.items {
		scope := strings.Join(t.Scope, ",")
		line := fmt.Sprintf("%-16s %-26s %s", t.ID, t.DisplayName, styleDim.Render(scope))
		if i == m.cursor {
			sb.WriteString(styleSelected.Render("> "+line) + "\n")
		} else {
			sb.WriteString("  " + line + "\n")
		}
	}
	sb.WriteString("\n" + hint("enter add provider  q back"))

	w := 60
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}
