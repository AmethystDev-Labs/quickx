package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"unsafe"

	"github.com/quickcli/quick/internal/app"
	quickconfig "github.com/quickcli/quick/internal/config"
	quicktemplate "github.com/quickcli/quick/internal/template"
)

type response struct {
	OK     bool        `json:"ok"`
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type configListResult struct {
	ActiveConfig string               `json:"activeConfig"`
	Configs      []quickconfig.Config `json:"configs"`
}

type placeholderResult struct {
	Question string `json:"question"`
	Default  string `json:"default"`
	Secret   bool   `json:"secret"`
}

type templateSetupResult struct {
	Template     quicktemplate.Template `json:"template"`
	Placeholders []placeholderResult    `json:"placeholders"`
}

type createConfigFromTemplateInput struct {
	Name    string            `json:"name"`
	ID      string            `json:"id"`
	Answers map[string]string `json:"answers"`
}

type deviceLoginState struct {
	Handle *app.DeviceCodeHandle
}

type browserLoginState struct {
	Wait func() error
}

var (
	handleCounter   atomic.Uint64
	deviceLoginMu   sync.Mutex
	deviceLoginMap  = map[string]*deviceLoginState{}
	browserLoginMu  sync.Mutex
	browserLoginMap = map[string]*browserLoginState{}
)

func marshalResponse(result interface{}, err error) *C.char {
	payload := response{OK: err == nil, Result: result}
	if err != nil {
		payload.Error = err.Error()
		payload.Result = nil
	}

	data, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		fallback := fmt.Sprintf(`{"ok":false,"error":%q}`, marshalErr.Error())
		return C.CString(fallback)
	}
	return C.CString(string(data))
}

func loadAPI() (*app.API, error) {
	return app.New()
}

func nextHandleID(prefix string) string {
	id := handleCounter.Add(1)
	return fmt.Sprintf("%s-%d", prefix, id)
}

//export QuickStatusJSON
func QuickStatusJSON() *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(api.Status(), nil)
}

//export QuickListConfigsJSON
func QuickListConfigsJSON() *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(configListResult{
		ActiveConfig: api.ActiveConfig(),
		Configs:      api.ListConfigs(),
	}, nil)
}

//export QuickUseConfig
func QuickUseConfig(name *C.char) *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	if err := api.UseConfig(C.GoString(name)); err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"message": "ok"}, nil)
}

type addConfigInput struct {
	Name       string   `json:"name"`
	Scope      []string `json:"scope"`
	BaseURL    string   `json:"baseUrl"`
	APIKey     string   `json:"apiKey"`
	Model      string   `json:"model"`
	WireAPI    string   `json:"wireApi"`
	AuthMethod string   `json:"authMethod"`
}

type updateConfigInput struct {
	Name             string   `json:"name"`
	DisplayName      string   `json:"displayName"`
	Scope            []string `json:"scope"`
	BaseURL          string   `json:"baseUrl"`
	APIKey           string   `json:"apiKey"`
	Model            string   `json:"model"`
	WireAPI          string   `json:"wireApi"`
	AuthMethod       string   `json:"authMethod"`
	ReasoningEffort  string   `json:"reasoningEffort"`
	ModelVerbosity   string   `json:"modelVerbosity"`
	TemplateID       string   `json:"templateId"`
	CodexTomlContent string   `json:"codexTomlContent"`
}

func normalizeConfigPayload(p updateConfigInput) quickconfig.Config {
	scope := p.Scope
	if len(scope) == 0 {
		scope = []string{quickconfig.ScopeCodex}
	}
	wireAPI := p.WireAPI
	if wireAPI == "" {
		wireAPI = "responses"
	}
	authMethod := p.AuthMethod
	if authMethod == "" {
		authMethod = "api_key"
	}
	displayName := p.DisplayName
	if displayName == "" {
		displayName = p.Name
	}
	return quickconfig.Config{
		Name:             p.Name,
		DisplayName:      displayName,
		Scope:            scope,
		BaseURL:          p.BaseURL,
		APIKey:           p.APIKey,
		Model:            p.Model,
		WireAPI:          wireAPI,
		AuthMethod:       authMethod,
		ReasoningEffort:  p.ReasoningEffort,
		ModelVerbosity:   p.ModelVerbosity,
		TemplateID:       p.TemplateID,
		CodexTomlContent: p.CodexTomlContent,
	}
}

//export QuickAddConfig
func QuickAddConfig(input *C.char) *C.char {
	var payload addConfigInput
	if err := json.Unmarshal([]byte(C.GoString(input)), &payload); err != nil {
		return marshalResponse(nil, fmt.Errorf("parse add config input: %w", err))
	}
	if payload.Name == "" {
		return marshalResponse(nil, fmt.Errorf("config name is required"))
	}
	if len(payload.Scope) == 0 {
		payload.Scope = []string{quickconfig.ScopeCodex}
	}
	if payload.WireAPI == "" {
		payload.WireAPI = "responses"
	}
	if payload.AuthMethod == "" {
		payload.AuthMethod = "api_key"
	}

	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	err = api.AddConfig(quickconfig.Config{
		Name:        payload.Name,
		DisplayName: payload.Name,
		Scope:       payload.Scope,
		BaseURL:     payload.BaseURL,
		APIKey:      payload.APIKey,
		Model:       payload.Model,
		WireAPI:     payload.WireAPI,
		AuthMethod:  payload.AuthMethod,
	})
	if err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"message": "ok"}, nil)
}

//export QuickUpdateConfig
func QuickUpdateConfig(input *C.char) *C.char {
	var payload updateConfigInput
	if err := json.Unmarshal([]byte(C.GoString(input)), &payload); err != nil {
		return marshalResponse(nil, fmt.Errorf("parse update config input: %w", err))
	}
	if payload.Name == "" {
		return marshalResponse(nil, fmt.Errorf("config name is required"))
	}

	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	if err := api.UpdateConfig(normalizeConfigPayload(payload)); err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"message": "ok"}, nil)
}

//export QuickRemoveConfig
func QuickRemoveConfig(name *C.char) *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	if err := api.RemoveConfig(C.GoString(name)); err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"message": "ok"}, nil)
}

//export QuickListTemplatesJSON
func QuickListTemplatesJSON() *C.char {
	templates, err := quicktemplate.FetchAll()
	if err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(templates, nil)
}

//export QuickPreviewTemplateJSON
func QuickPreviewTemplateJSON(id *C.char) *C.char {
	template, err := quicktemplate.FetchByID(C.GoString(id))
	if err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(template, nil)
}

//export QuickGetTemplateSetupJSON
func QuickGetTemplateSetupJSON(id *C.char) *C.char {
	template, err := quicktemplate.FetchByID(C.GoString(id))
	if err != nil {
		return marshalResponse(nil, err)
	}

	combined := strings.Join([]string{template.APIKey, template.Model, template.BaseURL}, "|")
	rawPlaceholders := quicktemplate.FindPlaceholders(combined)
	placeholders := make([]placeholderResult, 0, len(rawPlaceholders))
	for _, placeholder := range rawPlaceholders {
		placeholders = append(placeholders, placeholderResult{
			Question: placeholder.Question(),
			Default:  placeholder.Default(),
			Secret:   strings.Contains(strings.ToLower(placeholder.Question()), "key"),
		})
	}

	return marshalResponse(templateSetupResult{
		Template:     *template,
		Placeholders: placeholders,
	}, nil)
}

//export QuickCreateConfigFromTemplate
func QuickCreateConfigFromTemplate(input *C.char) *C.char {
	var payload createConfigFromTemplateInput
	if err := json.Unmarshal([]byte(C.GoString(input)), &payload); err != nil {
		return marshalResponse(nil, fmt.Errorf("parse template config input: %w", err))
	}
	template, err := quicktemplate.FetchByID(payload.ID)
	if err != nil {
		return marshalResponse(nil, err)
	}
	name := payload.Name
	if name == "" {
		name = template.ID
	}
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	if err := api.CreateConfigFromTemplate(name, *template, payload.Answers); err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"name": name}, nil)
}

//export QuickLoginCodexRequestDeviceJSON
func QuickLoginCodexRequestDeviceJSON() *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	handle, info, err := api.LoginCodexRequestDevice()
	if err != nil {
		return marshalResponse(nil, err)
	}
	handleID := nextHandleID("device")
	deviceLoginMu.Lock()
	deviceLoginMap[handleID] = &deviceLoginState{Handle: handle}
	deviceLoginMu.Unlock()
	return marshalResponse(map[string]string{
		"handleId":        handleID,
		"verificationUrl": info.VerificationURL,
		"userCode":        info.UserCode,
	}, nil)
}

//export QuickLoginCodexCompleteDevice
func QuickLoginCodexCompleteDevice(handleID *C.char) *C.char {
	key := C.GoString(handleID)
	deviceLoginMu.Lock()
	state, ok := deviceLoginMap[key]
	if ok {
		delete(deviceLoginMap, key)
	}
	deviceLoginMu.Unlock()
	if !ok {
		return marshalResponse(nil, fmt.Errorf("device login handle %q not found", key))
	}
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	if err := api.LoginCodexCompleteDevice(state.Handle, nil); err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"message": "ok"}, nil)
}

//export QuickLoginCodexBrowserStartJSON
func QuickLoginCodexBrowserStartJSON() *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	authURL, wait, err := api.LoginCodexBrowser(context.Background())
	if err != nil {
		return marshalResponse(nil, err)
	}
	handleID := nextHandleID("browser")
	browserLoginMu.Lock()
	browserLoginMap[handleID] = &browserLoginState{Wait: wait}
	browserLoginMu.Unlock()
	return marshalResponse(map[string]string{
		"handleId": handleID,
		"authUrl":  authURL,
	}, nil)
}

//export QuickLoginCodexBrowserWait
func QuickLoginCodexBrowserWait(handleID *C.char) *C.char {
	key := C.GoString(handleID)
	browserLoginMu.Lock()
	state, ok := browserLoginMap[key]
	if ok {
		delete(browserLoginMap, key)
	}
	browserLoginMu.Unlock()
	if !ok {
		return marshalResponse(nil, fmt.Errorf("browser login handle %q not found", key))
	}
	if err := state.Wait(); err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"message": "ok"}, nil)
}

//export QuickCreateCodexLoginConfig
func QuickCreateCodexLoginConfig(name *C.char) *C.char {
	api, err := loadAPI()
	if err != nil {
		return marshalResponse(nil, err)
	}
	created, err := api.CreateCodexLoginConfig(C.GoString(name))
	if err != nil {
		return marshalResponse(nil, err)
	}
	return marshalResponse(map[string]string{"name": created}, nil)
}

//export QuickFreeCString
func QuickFreeCString(value *C.char) {
	C.free(unsafe.Pointer(value))
}

func main() {}
