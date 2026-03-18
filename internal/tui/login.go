package tui

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/quickcli/quick/internal/app"
	"github.com/quickcli/quick/internal/login"
)

// ============================================================
// loginMethodScreen — choose Browser vs Device Code
// ============================================================

type loginMethod int

const (
	loginMethodBrowser loginMethod = iota
	loginMethodDevice
)

type loginMethodScreen struct {
	api         *app.API
	profileName string
	cursor      int
	width       int
}

func newLoginMethodScreen(api *app.API, profileName string) *loginMethodScreen {
	return &loginMethodScreen{api: api, profileName: profileName}
}

func (m *loginMethodScreen) Init() tea.Cmd { return nil }

func (m *loginMethodScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			return m, Pop()
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < 1 {
				m.cursor++
			}
		case "enter", " ":
			if m.cursor == 0 {
				return m, Push(newLoginExecScreen(m.api, m.profileName, loginMethodBrowser))
			}
			return m, Push(newLoginExecScreen(m.api, m.profileName, loginMethodDevice))
		}
	}
	return m, nil
}

func (m *loginMethodScreen) View() string {
	var sb strings.Builder
	sb.WriteString(styleTitle.Render("Login with ChatGPT (Codex)") + "\n\n")
	sb.WriteString(styleDim.Render("Choose a login method:") + "\n\n")

	options := []struct{ label, desc string }{
		{"Browser (recommended)", "Opens auth.openai.com in your browser"},
		{"Device Code", "For SSH / headless — visit a URL and enter a one-time code"},
	}
	for i, o := range options {
		if i == m.cursor {
			sb.WriteString(styleSelected.Render("> "+o.label) + "\n")
		} else {
			sb.WriteString("  " + o.label + "\n")
		}
		sb.WriteString(styleDim.Render("    "+o.desc) + "\n")
	}
	sb.WriteString("\n" + hint("↑/↓  enter  esc back"))

	w := 56
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}

// ============================================================
// loginExecScreen — runs the chosen flow and shows progress
// ============================================================

type loginExecState int

const (
	loginExecStateStarting loginExecState = iota
	loginExecStateAwait
	loginExecStateCreating
	loginExecStateDone
	loginExecStateError
)

// ---- Messages ----

type deviceCodeBothMsg struct {
	handle *app.DeviceCodeHandle
	info   app.DeviceCodeInfo
}
type browserURLReadyMsg struct {
	authURL string
	wait    func() error
}
type loginTokensOKMsg struct{}
type loginProfileCreatedMsg struct{ name string }
type loginExecErrMsg struct{ err error }

// ---- Model ----

type loginExecScreen struct {
	api        *app.API
	method     loginMethod
	configName string

	state   loginExecState
	spinner spinner.Model
	width   int

	// device-code flow
	deviceInfo   app.DeviceCodeInfo
	deviceHandle *app.DeviceCodeHandle

	// browser flow
	browserURL string

	createdConfig string
	errText       string
}

func newLoginExecScreen(api *app.API, configName string, method loginMethod) *loginExecScreen {
	s := spinner.New()
	s.Spinner = spinner.Dot
	return &loginExecScreen{
		api:        api,
		method:     method,
		configName: configName,
		state:      loginExecStateStarting,
		spinner:    s,
	}
}

// ---- Init ----

func (m *loginExecScreen) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.kickoffCmd())
}

// kickoffCmd starts the appropriate async step.
func (m *loginExecScreen) kickoffCmd() tea.Cmd {
	if m.method == loginMethodDevice {
		return func() tea.Msg {
			handle, info, err := m.api.LoginCodexRequestDevice()
			if err != nil {
				return loginExecErrMsg{err}
			}
			return deviceCodeBothMsg{handle: handle, info: info}
		}
	}
	// Browser: start local server and get the authorize URL.
	return func() tea.Msg {
		ctx, cancel := context.WithCancel(context.Background())
		authURL, wait, err := m.api.LoginCodexBrowser(ctx)
		if err != nil {
			cancel()
			return loginExecErrMsg{err}
		}
		return browserURLReadyMsg{
			authURL: authURL,
			wait: func() error {
				defer cancel()
				return wait()
			},
		}
	}
}

// pollDeviceCmd blocks in a goroutine until auth completes (or fails).
func (m *loginExecScreen) pollDeviceCmd() tea.Cmd {
	h := m.deviceHandle
	return func() tea.Msg {
		if err := m.api.LoginCodexCompleteDevice(h, nil); err != nil {
			return loginExecErrMsg{err}
		}
		return loginTokensOKMsg{}
	}
}

// waitBrowserCmd blocks until the browser callback arrives.
func waitBrowserCmd(wait func() error) tea.Cmd {
	return func() tea.Msg {
		if err := wait(); err != nil {
			return loginExecErrMsg{err}
		}
		return loginTokensOKMsg{}
	}
}

// createConfigCmd creates the config entry after successful login.
func (m *loginExecScreen) createConfigCmd() tea.Cmd {
	name := m.configName
	return func() tea.Msg {
		created, err := m.api.CreateCodexLoginConfig(name)
		if err != nil {
			return loginExecErrMsg{err}
		}
		return loginProfileCreatedMsg{name: created}
	}
}

// ---- Update ----

func (m *loginExecScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width

	case spinner.TickMsg:
		if m.state == loginExecStateStarting ||
			m.state == loginExecStateAwait ||
			m.state == loginExecStateCreating {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	// ── Device code: server returned URL + code ──
	case deviceCodeBothMsg:
		m.deviceHandle = msg.handle
		m.deviceInfo = msg.info
		m.state = loginExecStateAwait
		return m, m.pollDeviceCmd()

	// ── Browser: local server is running, URL is ready ──
	case browserURLReadyMsg:
		m.browserURL = msg.authURL
		m.state = loginExecStateAwait
		// Fire-and-forget; user can still copy the URL manually if auto-open fails.
		_ = login.OpenBrowser(msg.authURL)
		return m, waitBrowserCmd(msg.wait)

	// ── Both flows: tokens written to auth.json ──
	case loginTokensOKMsg:
		m.state = loginExecStateCreating
		return m, m.createConfigCmd()

	// ── Config created ──
	case loginProfileCreatedMsg:
		m.createdConfig = msg.name
		m.state = loginExecStateDone
		return m, FlashOK(fmt.Sprintf("Logged in! Config %q created.", msg.name))

	// ── Any async error ──
	case loginExecErrMsg:
		m.errText = msg.err.Error()
		m.state = loginExecStateError

	// ── Keyboard ──
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			return m, Pop()
		case "enter", " ":
			if m.state == loginExecStateDone || m.state == loginExecStateError {
				return m, Pop()
			}
		}
	}

	return m, nil
}

// ---- View ----

func (m *loginExecScreen) View() string {
	var sb strings.Builder
	sb.WriteString(styleTitle.Render("Login with ChatGPT (Codex)") + "\n\n")

	switch m.state {
	case loginExecStateStarting:
		sb.WriteString(m.spinner.View() + "  ")
		if m.method == loginMethodDevice {
			sb.WriteString("Requesting device code…")
		} else {
			sb.WriteString("Starting browser login…")
		}
		sb.WriteString("\n\n" + hint("esc cancel"))

	case loginExecStateAwait:
		if m.method == loginMethodDevice {
			sb.WriteString("1. Open this URL in your browser:\n")
			sb.WriteString(styleSelected.Render("   "+m.deviceInfo.VerificationURL) + "\n\n")
			sb.WriteString("2. Enter this one-time code:\n")
			sb.WriteString(styleSelected.Render("   "+m.deviceInfo.UserCode) + "\n\n")
			sb.WriteString(m.spinner.View() + styleDim.Render("  Waiting for you to authenticate…"))
		} else {
			sb.WriteString("Your browser should open automatically.\n")
			sb.WriteString("If not, open this URL manually:\n\n")
			sb.WriteString(styleSelected.Render("  "+m.browserURL) + "\n\n")
			sb.WriteString(m.spinner.View() + styleDim.Render("  Waiting for browser callback…"))
		}
		sb.WriteString("\n\n" + hint("esc cancel"))

	case loginExecStateCreating:
		sb.WriteString(styleSuccess.Render("✓") + "  Authentication successful!\n\n")
		sb.WriteString(m.spinner.View() + "  Saving config…")
		sb.WriteString("\n\n" + hint("esc cancel"))

	case loginExecStateDone:
		sb.WriteString(styleSuccess.Render("✓  Logged in successfully!") + "\n\n")
		sb.WriteString(fmt.Sprintf("Config %q created.\n", m.createdConfig))
		sb.WriteString("Run " + styleSelected.Render(fmt.Sprintf("quick use %s", m.createdConfig)) + " to activate it.\n")
		sb.WriteString("\n" + hint("enter / esc  back"))

	case loginExecStateError:
		sb.WriteString(styleError.Render("✗  Login failed") + "\n\n")
		sb.WriteString(styleMuted.Render(m.errText) + "\n")
		sb.WriteString("\n" + hint("esc back"))
	}

	w := 62
	if m.width > 0 && m.width < w+4 {
		w = m.width - 4
	}
	return box(sb.String(), w)
}
