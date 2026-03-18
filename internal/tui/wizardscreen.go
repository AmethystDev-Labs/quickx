package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

// Field is one prompt in a wizard, used by both the TUI stack and RunWizard.
type Field struct {
	Label       string // shown as the question
	Default     string // pre-filled default value
	Placeholder string // grey hint inside input (overrides Default if set)
	Secret      bool   // masks the input
}

// wizardScreen is a sequential multi-field input screen.
//
// Stack mode: onDone returns a tea.Cmd (e.g. Pop + save). onCancel is returned on Esc.
// Standalone mode: pass nil for onDone AND onCancel. The model calls tea.Quit when
// done or cancelled; callers use RunWizard to extract answers.
type wizardScreen struct {
	title     string
	fields    []Field
	answers   []string
	current   int
	input     textinput.Model
	onDone    func([]string) tea.Cmd // nil in standalone mode
	onCancel  tea.Cmd               // nil in standalone mode
	width     int
	cancelled bool // standalone: user pressed Esc
}

func newWizardScreen(
	title string,
	fields []Field,
	onDone func([]string) tea.Cmd,
	onCancel tea.Cmd,
) *wizardScreen {
	ti := textinput.New()
	ti.Width = 40
	ti.Focus()
	m := &wizardScreen{
		title:    title,
		fields:   fields,
		answers:  make([]string, len(fields)),
		input:    ti,
		onDone:   onDone,
		onCancel: onCancel,
	}
	if len(fields) > 0 {
		m.applyField(0)
	}
	return m
}

func (m *wizardScreen) applyField(i int) {
	f := m.fields[i]
	m.input.SetValue("")
	m.input.Placeholder = f.Default
	if f.Placeholder != "" {
		m.input.Placeholder = f.Placeholder
	}
	if f.Secret {
		m.input.EchoMode = textinput.EchoPassword
	} else {
		m.input.EchoMode = textinput.EchoNormal
	}
}

func (m *wizardScreen) Init() tea.Cmd { return textinput.Blink }

func (m *wizardScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		w := msg.Width - 8
		if w > 60 {
			w = 60
		}
		if w > 0 {
			m.input.Width = w
		}
	case ScreenFocusedMsg:
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			if m.onCancel != nil {
				return m, m.onCancel
			}
			// standalone mode
			m.cancelled = true
			return m, tea.Quit
		case "enter":
			val := strings.TrimSpace(m.input.Value())
			if val == "" {
				val = m.fields[m.current].Default
			}
			m.answers[m.current] = val
			m.current++
			if m.current >= len(m.fields) {
				if m.onDone != nil {
					return m, m.onDone(m.answers)
				}
				// standalone mode
				return m, tea.Quit
			}
			m.applyField(m.current)
			return m, textinput.Blink
		}
	}
	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m *wizardScreen) View() string {
	if len(m.fields) == 0 || m.current >= len(m.fields) {
		return ""
	}
	f := m.fields[m.current]
	progress := fmt.Sprintf("(%d/%d)", m.current+1, len(m.fields))

	var body strings.Builder
	body.WriteString(styleTitle.Render(m.title) + "  " + styleDim.Render(progress) + "\n\n")
	body.WriteString(styleSelected.Render(f.Label) + "\n")
	if f.Default != "" {
		body.WriteString(styleDim.Render("default: "+f.Default) + "\n")
	}
	body.WriteString("\n" + m.input.View() + "\n\n")
	body.WriteString(hint("enter confirm  esc cancel"))

	w := 48
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(body.String(), w)
}

// RunWizard runs the wizard as a standalone terminal program and returns answers.
// Returns nil, nil if the user cancelled.
func RunWizard(title string, fields []Field) ([]string, error) {
	if len(fields) == 0 {
		return []string{}, nil
	}
	m := newWizardScreen(title, fields, nil, nil)
	p := tea.NewProgram(m, tea.WithAltScreen())
	result, err := p.Run()
	if err != nil {
		return nil, err
	}
	final := result.(*wizardScreen)
	if final.cancelled {
		return nil, nil
	}
	return final.answers, nil
}
