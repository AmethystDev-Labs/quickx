// Package login implements OpenAI Codex authentication.
//
// Two flows are supported:
//
//	Device Code: headless / SSH environments — user visits a URL and enters a code.
//	Browser PKCE: desktop environments — a local callback server receives the auth code.
//
// Reference: https://github.com/openai/codex/tree/main/codex-rs/login/src
package login

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// ---- Constants ----

const (
	// IssuerURL is the OpenAI auth server.
	IssuerURL = "https://auth.openai.com"
	// ClientID is the public Codex CLI OAuth client identifier.
	ClientID = "app_EMoamEEZ73f0CkXaXp7hrann"
	// callbackPort is the local port used for the browser OAuth callback.
	callbackPort = 1455
	// oauthScope matches the scopes requested by the official Codex CLI.
	oauthScope = "openid profile email offline_access api.connectors.read api.connectors.invoke"
)

// ---- Shared types ----

// TokenResponse holds the raw OAuth tokens returned by the server.
type TokenResponse struct {
	IDToken      string `json:"id_token"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// tokenData is stored inside auth.json under the "tokens" key.
type tokenData struct {
	IDToken      string  `json:"id_token"`
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	AccountID    *string `json:"account_id,omitempty"`
}

// AuthDotJson mirrors ~/.codex/auth.json.
// All fields are pointers / omitempty so partial updates never clobber existing data.
type AuthDotJson struct {
	AuthMode     *string    `json:"auth_mode,omitempty"`
	OpenAIAPIKey *string    `json:"OPENAI_API_KEY,omitempty"`
	Tokens       *tokenData `json:"tokens,omitempty"`
	LastRefresh  *time.Time `json:"last_refresh,omitempty"`
}

// pkceCodes holds a PKCE verifier / challenge pair.
type pkceCodes struct {
	codeVerifier  string
	codeChallenge string
}

// ---- auth.json helpers ----

// WriteAPIKey merges an API key into auth.json and sets auth_mode to "apikey".
// This intentionally clears any ChatGPT auth_mode that was set by a previous
// login so Codex does not try to refresh OAuth tokens when using an API key.
func WriteAPIKey(codexHome, apiKey string) error {
	return updateAuthFile(codexHome, func(a *AuthDotJson) {
		mode := "apikey"
		a.AuthMode = &mode
		a.OpenAIAPIKey = &apiKey
	})
}

// EmailFromIDToken extracts the "email" claim from a JWT id_token without
// verifying the signature (validation is handled server-side).
// Returns "" if the token is malformed or the claim is absent.
func EmailFromIDToken(idToken string) string {
	parts := strings.SplitN(idToken, ".", 3)
	if len(parts) < 2 {
		return ""
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ""
	}
	var claims struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return ""
	}
	return claims.Email
}

// ClearAuthMode removes auth_mode from auth.json so Codex does not try to use
// ChatGPT token refresh when switching to a provider that needs no auth.
func ClearAuthMode(codexHome string) error {
	return updateAuthFile(codexHome, func(a *AuthDotJson) {
		a.AuthMode = nil
	})
}

// PersistTokens writes OAuth tokens to auth.json, preserving any existing API key.
func PersistTokens(codexHome string, tokens *TokenResponse) error {
	return updateAuthFile(codexHome, func(a *AuthDotJson) {
		mode := "chatgpt"
		a.AuthMode = &mode
		a.Tokens = &tokenData{
			IDToken:      tokens.IDToken,
			AccessToken:  tokens.AccessToken,
			RefreshToken: tokens.RefreshToken,
		}
		now := time.Now().UTC()
		a.LastRefresh = &now
	})
}

// updateAuthFile reads auth.json (if present), applies mutFn, then writes it back.
func updateAuthFile(codexHome string, mutFn func(*AuthDotJson)) error {
	path := filepath.Join(codexHome, "auth.json")

	var existing AuthDotJson
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &existing)
	}
	mutFn(&existing)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal auth.json: %w", err)
	}
	if err := os.MkdirAll(codexHome, 0o700); err != nil {
		return fmt.Errorf("mkdir %s: %w", codexHome, err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write auth.json: %w", err)
	}
	return nil
}

// ---- Common OAuth step ----

// ExchangeCodeForTokens exchanges an authorization code for OAuth tokens via PKCE.
// redirectURI must exactly match the URI used when building the authorization URL.
func ExchangeCodeForTokens(authCode, codeVerifier, redirectURI string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", authCode)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", ClientID)
	form.Set("code_verifier", codeVerifier)

	resp, err := http.Post(
		IssuerURL+"/oauth/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token exchange failed (%s): %s", resp.Status, b)
	}
	var t TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&t); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	return &t, nil
}

// ============================================================
// Device Code Flow
// ============================================================

// DeviceCode holds the info needed to show the user where to authenticate.
type DeviceCode struct {
	DeviceAuthID    string
	UserCode        string
	VerificationURL string
	Interval        uint // polling interval in seconds
}

type userCodeRequest struct{ ClientID string `json:"client_id"` }

type userCodeResp struct {
	DeviceAuthID string `json:"device_auth_id"`
	UserCode     string `json:"user_code"`
	Interval     string `json:"interval"` // server sends as string
}

type tokenPollRequest struct {
	DeviceAuthID string `json:"device_auth_id"`
	UserCode     string `json:"user_code"`
}

type codeSuccessResp struct {
	AuthorizationCode string `json:"authorization_code"`
	CodeVerifier      string `json:"code_verifier"`
}

// RequestDeviceCode initiates the device-code flow and returns display info.
func RequestDeviceCode() (*DeviceCode, error) {
	body, _ := json.Marshal(userCodeRequest{ClientID: ClientID})
	resp, err := http.Post(
		IssuerURL+"/api/accounts/deviceauth/usercode",
		"application/json",
		strings.NewReader(string(body)),
	)
	if err != nil {
		return nil, fmt.Errorf("request device code: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusNotFound:
		return nil, fmt.Errorf("device code login is not enabled on this Codex server")
	case http.StatusOK:
	default:
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("device code request failed (%s): %s", resp.Status, b)
	}

	var uc userCodeResp
	if err := json.NewDecoder(resp.Body).Decode(&uc); err != nil {
		return nil, fmt.Errorf("decode device code response: %w", err)
	}

	interval := uint(5)
	if n, err := strconv.ParseUint(strings.TrimSpace(uc.Interval), 10, 64); err == nil && n > 0 {
		interval = uint(n)
	}
	return &DeviceCode{
		DeviceAuthID:    uc.DeviceAuthID,
		UserCode:        uc.UserCode,
		VerificationURL: IssuerURL + "/codex/device",
		Interval:        interval,
	}, nil
}

// PollForCode polls until the user completes browser auth (up to 15 min).
// tickFn (may be nil) is called before each poll attempt — use it to update a spinner.
func PollForCode(dc *DeviceCode, tickFn func()) (*codeSuccessResp, error) {
	deadline := time.Now().Add(15 * time.Minute)
	interval := time.Duration(dc.Interval) * time.Second
	if interval < time.Second {
		interval = 5 * time.Second
	}

	reqBody, _ := json.Marshal(tokenPollRequest{
		DeviceAuthID: dc.DeviceAuthID,
		UserCode:     dc.UserCode,
	})

	for time.Now().Before(deadline) {
		time.Sleep(interval)
		if tickFn != nil {
			tickFn()
		}

		resp, err := http.Post(
			IssuerURL+"/api/accounts/deviceauth/token",
			"application/json",
			strings.NewReader(string(reqBody)),
		)
		if err != nil {
			return nil, fmt.Errorf("poll device token: %w", err)
		}

		if resp.StatusCode == http.StatusOK {
			var code codeSuccessResp
			err = json.NewDecoder(resp.Body).Decode(&code)
			resp.Body.Close()
			if err != nil {
				return nil, fmt.Errorf("decode poll response: %w", err)
			}
			return &code, nil
		}
		resp.Body.Close()

		// 403 / 404 = still pending, keep polling
		if resp.StatusCode != http.StatusForbidden && resp.StatusCode != http.StatusNotFound {
			return nil, fmt.Errorf("device auth failed: %s", resp.Status)
		}
	}
	return nil, fmt.Errorf("device auth timed out after 15 minutes")
}

// CompleteDeviceLogin polls, exchanges the code, and persists tokens to auth.json.
// tickFn (may be nil) is called before each poll attempt.
func CompleteDeviceLogin(dc *DeviceCode, codexHome string, tickFn func()) error {
	code, err := PollForCode(dc, tickFn)
	if err != nil {
		return err
	}
	redirectURI := IssuerURL + "/deviceauth/callback"
	tokens, err := ExchangeCodeForTokens(code.AuthorizationCode, code.CodeVerifier, redirectURI)
	if err != nil {
		return err
	}
	return PersistTokens(codexHome, tokens)
}

// ============================================================
// Browser OAuth (PKCE) Flow
// ============================================================

// BrowserLoginResult carries the URL the user should open in their browser.
// It is returned synchronously so the caller can display / open it before
// waiting for the callback.
type BrowserLoginResult struct {
	AuthorizeURL string // open this in the user's browser
}

// LoginWithBrowser starts a local callback server and returns the URL to open.
// The returned wait function blocks until the browser callback completes (or ctx is cancelled).
func LoginWithBrowser(ctx context.Context, codexHome string) (authorizeURL string, wait func() error, err error) {
	pkce, err := generatePKCE()
	if err != nil {
		return "", nil, fmt.Errorf("generate pkce: %w", err)
	}
	state, err := generateState()
	if err != nil {
		return "", nil, fmt.Errorf("generate state: %w", err)
	}

	redirectURI := fmt.Sprintf("http://localhost:%d/auth/callback", callbackPort)

	// Build the authorization URL.
	authURL := buildAuthorizeURL(pkce, state, redirectURI)

	// Start local callback server.
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", callbackPort))
	if err != nil {
		return "", nil, fmt.Errorf("bind port %d: %w (try --device for headless login)", callbackPort, err)
	}

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	srv := &http.Server{Handler: mux}

	mux.HandleFunc("/auth/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		gotState := q.Get("state")
		if gotState != state {
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprint(w, callbackHTML("Login Failed", "State mismatch. Please try again.", false))
			errCh <- fmt.Errorf("oauth state mismatch")
			return
		}
		if errCode := q.Get("error"); errCode != "" {
			desc := q.Get("error_description")
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, callbackHTML("Login Failed", html.EscapeString(errCode+": "+desc), false))
			errCh <- fmt.Errorf("oauth error: %s: %s", errCode, desc)
			return
		}
		code := q.Get("code")
		if code == "" {
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprint(w, callbackHTML("Login Failed", "No code in callback.", false))
			errCh <- fmt.Errorf("no code in callback")
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, callbackHTML("Login Successful", "You can close this tab and return to the terminal.", true))
		codeCh <- code
	})

	go func() { _ = srv.Serve(ln) }()

	wait = func() error {
		defer func() { _ = srv.Shutdown(context.Background()) }()

		select {
		case code := <-codeCh:
			tokens, err := ExchangeCodeForTokens(code, pkce.codeVerifier, redirectURI)
			if err != nil {
				return err
			}
			return PersistTokens(codexHome, tokens)
		case err := <-errCh:
			return err
		case <-ctx.Done():
			return fmt.Errorf("browser login cancelled")
		}
	}

	return authURL, wait, nil
}

// OpenBrowser opens url in the system's default browser.
func OpenBrowser(rawURL string) error {
	return openBrowserPlatform(rawURL)
}

// ---- PKCE helpers ----

func generatePKCE() (pkceCodes, error) {
	buf := make([]byte, 64)
	if _, err := rand.Read(buf); err != nil {
		return pkceCodes{}, err
	}
	enc := base64.RawURLEncoding
	verifier := enc.EncodeToString(buf)

	digest := sha256.Sum256([]byte(verifier))
	challenge := enc.EncodeToString(digest[:])

	return pkceCodes{codeVerifier: verifier, codeChallenge: challenge}, nil
}

func generateState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func buildAuthorizeURL(pkce pkceCodes, state, redirectURI string) string {
	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", ClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("scope", oauthScope)
	params.Set("code_challenge", pkce.codeChallenge)
	params.Set("code_challenge_method", "S256")
	params.Set("id_token_add_organizations", "true")
	params.Set("codex_cli_simplified_flow", "true")
	params.Set("state", state)
	return IssuerURL + "/oauth/authorize?" + params.Encode()
}

// ---- callback page HTML ----

func callbackHTML(title, message string, success bool) string {
	color := "#e53e3e"
	if success {
		color = "#38a169"
	}
	return fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>%s</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;
justify-content:center;min-height:100vh;margin:0;background:#f7fafc}
.card{text-align:center;padding:2rem 3rem;border-radius:8px;background:#fff;
box-shadow:0 2px 12px rgba(0,0,0,.1)}h1{color:%s;margin-bottom:.5rem}
p{color:#4a5568}</style></head>
<body><div class="card"><h1>%s</h1><p>%s</p></div></body></html>`,
		title, color, title, message)
}
