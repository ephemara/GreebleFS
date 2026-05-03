// Go PTY panel runtime. This is a fast-path integrated shell surface for the
// common case: normal shell output, prompt interaction, copy/paste, and
// scrollback. When it encounters terminal control sequences that v1 does not
// emulate safely, it requests an automatic xterm fallback from the React host.
//
//go:build js && wasm
// +build js,wasm

package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"syscall/js"

	"greeblefs.dev/sdk/greeblefs-go/hostapi"
	"greeblefs.dev/sdk/greeblefs-go/panel"
)

func main() {
	if err := panel.Run(renderTerminalPanel); err != nil {
		fmt.Println("go-pty-panel runtime exited with error:", err)
	}
}

type terminalHostTheme struct {
	Background string `json:"background"`
	Foreground string `json:"foreground"`
	Border     string `json:"border"`
	Accent     string `json:"accent"`
}

type terminalHostConfig struct {
	TerminalID       string            `json:"terminalId"`
	WorkingDirectory *string           `json:"workingDirectory,omitempty"`
	ShellCommand     *string           `json:"shellCommand,omitempty"`
	FontFamily       string            `json:"fontFamily"`
	FontSize         int               `json:"fontSize"`
	Scrollback       int               `json:"scrollback"`
	CursorBlink      bool              `json:"cursorBlink"`
	CursorStyle      string            `json:"cursorStyle"`
	Theme            terminalHostTheme `json:"theme"`
}

type hostContext struct {
	TerminalHost terminalHostConfig `json:"terminalHost"`
}

type terminalOutputEvent struct {
	TerminalID string `json:"terminalId"`
	Data       string `json:"data"`
}

type terminalShellIntegrationEvent struct {
	ID string `json:"id"`
}

type panelCommand struct {
	Type  string `json:"type"`
	Label string `json:"label,omitempty"`
	Body  string `json:"body,omitempty"`
	Tone  string `json:"tone,omitempty"`
}

type terminalPanel struct {
	bridge   *hostapi.Bridge
	services *hostapi.ServiceClients
	config   terminalHostConfig
	root     js.Value
	scroller js.Value
	content  js.Value
	model    *plainTerminalModel
	fallback bool

	keydownCallback      js.Func
	pasteCallback        js.Func
	focusCallback        js.Func
	commandCallback      js.Func
	resizeCallback       js.Func
	resizeObserver       js.Value
	outputSubscriptionID string
	shellSubscriptionID  string

	keydownCallbackInstalled bool
	pasteCallbackInstalled   bool
	focusCallbackInstalled   bool
	commandCallbackInstalled bool
	resizeCallbackInstalled  bool
}

func renderTerminalPanel(mount panel.Mount) (panel.Unmount, error) {
	config, err := readTerminalHostConfig(mount.Bridge.Context())
	if err != nil {
		return nil, err
	}
	services := mount.Bridge.Services()
	panelState := &terminalPanel{
		bridge:   mount.Bridge,
		services: services,
		config:   config,
		root:     mount.Root,
		model:    newPlainTerminalModel(max(256, config.Scrollback)),
	}
	panelState.mountDOM()
	if err := panelState.installHostSubscriptions(); err != nil {
		return nil, err
	}
	if err := panelState.spawnTerminal(); err != nil {
		panelState.unmount()
		return nil, err
	}
	panelState.installDomListeners()
	panelState.emitHostEvent("terminal-ready", nil)

	return func() {
		panelState.unmount()
	}, nil
}

func readTerminalHostConfig(contextValue js.Value) (terminalHostConfig, error) {
	hostValue := contextValue.Get("terminalHost")
	if hostValue.IsUndefined() || hostValue.IsNull() {
		return terminalHostConfig{}, fmt.Errorf("go-pty-panel: terminalHost context is missing")
	}
	raw := js.Global().Get("JSON").Call("stringify", hostValue).String()
	var config terminalHostConfig
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		return terminalHostConfig{}, fmt.Errorf("go-pty-panel: failed to decode terminalHost context: %w", err)
	}
	if strings.TrimSpace(config.TerminalID) == "" {
		return terminalHostConfig{}, fmt.Errorf("go-pty-panel: terminalId is required")
	}
	if config.FontSize <= 0 {
		config.FontSize = 13
	}
	if config.Scrollback <= 0 {
		config.Scrollback = 10000
	}
	if config.FontFamily == "" {
		config.FontFamily = "monospace"
	}
	return config, nil
}

func (p *terminalPanel) mountDOM() {
	document := js.Global().Get("document")
	p.root.Set("tabIndex", 0)
	p.root.Get("style").Set("outline", "none")
	p.root.Get("style").Set("overflow", "hidden")
	p.root.Get("style").Set("background", p.config.Theme.Background)
	p.root.Get("style").Set("color", p.config.Theme.Foreground)

	p.scroller = document.Call("createElement", "div")
	p.scroller.Get("style").Set("position", "absolute")
	p.scroller.Get("style").Set("inset", "0")
	p.scroller.Get("style").Set("overflow", "auto")
	p.scroller.Get("style").Set("padding", "8px 10px")
	p.scroller.Get("style").Set("boxSizing", "border-box")
	p.scroller.Get("style").Set("fontFamily", p.config.FontFamily)
	p.scroller.Get("style").Set("fontSize", fmt.Sprintf("%dpx", p.config.FontSize))
	p.scroller.Get("style").Set("lineHeight", "1.35")
	p.scroller.Get("style").Set("whiteSpace", "pre")
	p.scroller.Get("style").Set("tabSize", "4")

	p.content = document.Call("createElement", "pre")
	p.content.Get("style").Set("margin", "0")
	p.content.Get("style").Set("minHeight", "100%")
	p.content.Get("style").Set("fontFamily", "inherit")
	p.content.Get("style").Set("fontSize", "inherit")
	p.content.Get("style").Set("lineHeight", "inherit")
	p.content.Get("style").Set("color", p.config.Theme.Foreground)
	p.content.Get("style").Set("background", "transparent")
	p.content.Get("style").Set("whiteSpace", "pre")
	p.content.Get("style").Set("userSelect", "text")

	p.scroller.Call("appendChild", p.content)
	p.root.Call("appendChild", p.scroller)
	p.render()
}

func (p *terminalPanel) spawnTerminal() error {
	rows, cols := p.measureRowsAndCols()
	request := hostapi.HostTerminalSpawnRequest{
		ID:         p.config.TerminalID,
		WorkingDir: p.config.WorkingDirectory,
		Shell:      p.config.ShellCommand,
		Rows:       uint16Ptr(rows),
		Cols:       uint16Ptr(cols),
	}
	if err := p.services.Terminal.Spawn(request); err != nil {
		return err
	}
	_, err := p.services.Terminal.RegisterShellIntegration(hostapi.HostTerminalShellIntegrationRequest{
		ID:             p.config.TerminalID,
		SupportsAutoCD: boolPtr(true),
		AtPrompt:       boolPtr(true),
	})
	return err
}

func (p *terminalPanel) installHostSubscriptions() error {
	outputSubscription, err := p.services.Events.Subscribe(hostapi.HostSubscriptionRequest{
		Topics: []string{"terminal.output"},
	}, func(event hostapi.HostEventEnvelope) {
		if event.PayloadJSON == nil {
			return
		}
		var payload terminalOutputEvent
		if err := json.Unmarshal([]byte(*event.PayloadJSON), &payload); err != nil {
			return
		}
		if payload.TerminalID != p.config.TerminalID {
			return
		}
		sanitized, unsupported := p.model.Consume(payload.Data)
		if unsupported {
			p.requestFallback("Go PTY panel hit an unsupported terminal control path.")
			return
		}
		if sanitized != "" {
			p.render()
			p.emitHostEvent("terminal-output", map[string]any{"data": sanitized})
		}
	})
	if err != nil {
		return err
	}
	p.outputSubscriptionID = outputSubscription.SubscriptionID

	shellSubscription, err := p.services.Events.Subscribe(hostapi.HostSubscriptionRequest{
		Topics: []string{"terminal.shell_integration.changed"},
	}, func(event hostapi.HostEventEnvelope) {
		if event.PayloadJSON == nil {
			return
		}
		var payload terminalShellIntegrationEvent
		if err := json.Unmarshal([]byte(*event.PayloadJSON), &payload); err != nil {
			return
		}
		if payload.ID != p.config.TerminalID {
			return
		}
	})
	if err != nil {
		_ = p.services.Events.Unsubscribe(p.outputSubscriptionID)
		p.outputSubscriptionID = ""
		return err
	}
	p.shellSubscriptionID = shellSubscription.SubscriptionID
	return nil
}

func (p *terminalPanel) installDomListeners() {
	p.keydownCallback = js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) == 0 {
			return nil
		}
		event := args[0]
		data := encodeKeyboardEvent(event)
		if data == "" {
			return nil
		}
		event.Call("preventDefault")
		p.emitHostEvent("terminal-focus", nil)
		p.emitHostEvent("terminal-input", map[string]any{"data": data})
		return nil
	})
	p.root.Call("addEventListener", "keydown", p.keydownCallback)
	p.keydownCallbackInstalled = true

	p.pasteCallback = js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) == 0 {
			return nil
		}
		event := args[0]
		clipboardData := event.Get("clipboardData")
		if clipboardData.IsUndefined() || clipboardData.IsNull() {
			return nil
		}
		text := clipboardData.Call("getData", "text").String()
		if text == "" {
			return nil
		}
		event.Call("preventDefault")
		p.emitHostEvent("terminal-focus", nil)
		p.emitHostEvent("terminal-input", map[string]any{"data": text})
		return nil
	})
	p.root.Call("addEventListener", "paste", p.pasteCallback)
	p.pasteCallbackInstalled = true

	p.focusCallback = js.FuncOf(func(this js.Value, args []js.Value) any {
		p.emitHostEvent("terminal-focus", nil)
		return nil
	})
	p.root.Call("addEventListener", "pointerdown", p.focusCallback)
	p.focusCallbackInstalled = true

	p.commandCallback = js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) == 0 {
			return nil
		}
		detail := args[0].Get("detail")
		if detail.IsUndefined() || detail.IsNull() {
			return nil
		}
		commandType := detail.Get("type").String()
		switch commandType {
		case "focus":
			p.root.Call("focus")
		case "clear":
			p.model.Clear()
			p.render()
		case "append-local-message":
			label := detail.Get("label").String()
			body := detail.Get("body").String()
			if strings.TrimSpace(body) != "" {
				p.model.AppendPlain("\n[" + label + "]\n" + body + "\n")
				p.render()
			}
		}
		return nil
	})
	p.root.Call("addEventListener", "greeblefs-terminal-panel-command", p.commandCallback)
	p.commandCallbackInstalled = true

	p.resizeCallback = js.FuncOf(func(this js.Value, args []js.Value) any {
		rows, cols := p.measureRowsAndCols()
		if err := p.services.Terminal.Resize(hostapi.HostTerminalResizeRequest{
			ID:   p.config.TerminalID,
			Rows: rows,
			Cols: cols,
		}); err == nil {
			p.emitHostEvent("terminal-resize", map[string]any{
				"rows": rows,
				"cols": cols,
			})
		}
		return nil
	})
	p.resizeCallbackInstalled = true
	resizeObserverCtor := js.Global().Get("ResizeObserver")
	if !resizeObserverCtor.IsUndefined() && !resizeObserverCtor.IsNull() {
		p.resizeObserver = resizeObserverCtor.New(p.resizeCallback)
		p.resizeObserver.Call("observe", p.root)
	}
}

func (p *terminalPanel) measureRowsAndCols() (uint16, uint16) {
	width := float64(p.root.Get("clientWidth").Int())
	height := float64(p.root.Get("clientHeight").Int())
	charWidth := math.Max(7, float64(p.config.FontSize)*0.62)
	lineHeight := math.Max(14, float64(p.config.FontSize)*1.35)
	rows := uint16(max(2, int(height/lineHeight)))
	cols := uint16(max(10, int(width/charWidth)))
	return rows, cols
}

func (p *terminalPanel) render() {
	if p.content.IsUndefined() || p.content.IsNull() {
		return
	}
	atBottom := true
	if !p.scroller.IsUndefined() && !p.scroller.IsNull() {
		scrollTop := p.scroller.Get("scrollTop").Float()
		scrollHeight := p.scroller.Get("scrollHeight").Float()
		clientHeight := p.scroller.Get("clientHeight").Float()
		atBottom = scrollTop+clientHeight >= scrollHeight-18
	}
	p.content.Set("textContent", p.model.Text())
	if atBottom {
		p.scroller.Set("scrollTop", p.scroller.Get("scrollHeight"))
	}
}

func (p *terminalPanel) emitHostEvent(name string, payload map[string]any) {
	p.bridge.EmitEvent("host-event", map[string]any{
		"name":    name,
		"payload": payload,
	})
}

func (p *terminalPanel) requestFallback(reason string) {
	if p.fallback {
		return
	}
	p.fallback = true
	p.emitHostEvent("terminal-fallback-requested", map[string]any{"reason": reason})
}

func (p *terminalPanel) unmount() {
	if p.outputSubscriptionID != "" {
		_ = p.services.Events.Unsubscribe(p.outputSubscriptionID)
	}
	if p.shellSubscriptionID != "" {
		_ = p.services.Events.Unsubscribe(p.shellSubscriptionID)
	}
	_ = p.services.Terminal.Kill(p.config.TerminalID)
	if !p.resizeObserver.IsUndefined() && !p.resizeObserver.IsNull() {
		p.resizeObserver.Call("disconnect")
	}
	if p.keydownCallbackInstalled {
		p.root.Call("removeEventListener", "keydown", p.keydownCallback)
		p.keydownCallback.Release()
	}
	if p.pasteCallbackInstalled {
		p.root.Call("removeEventListener", "paste", p.pasteCallback)
		p.pasteCallback.Release()
	}
	if p.focusCallbackInstalled {
		p.root.Call("removeEventListener", "pointerdown", p.focusCallback)
		p.focusCallback.Release()
	}
	if p.commandCallbackInstalled {
		p.root.Call("removeEventListener", "greeblefs-terminal-panel-command", p.commandCallback)
		p.commandCallback.Release()
	}
	if p.resizeCallbackInstalled {
		p.resizeCallback.Release()
	}
}

type plainTerminalModel struct {
	lines    []string
	maxLines int
}

func newPlainTerminalModel(maxLines int) *plainTerminalModel {
	return &plainTerminalModel{
		lines:    []string{""},
		maxLines: max(256, maxLines),
	}
}

func (m *plainTerminalModel) EnsureLine() {
	if len(m.lines) == 0 {
		m.lines = []string{""}
	}
}

func (m *plainTerminalModel) current() string {
	m.EnsureLine()
	return m.lines[len(m.lines)-1]
}

func (m *plainTerminalModel) setCurrent(value string) {
	m.EnsureLine()
	m.lines[len(m.lines)-1] = value
}

func (m *plainTerminalModel) newline() {
	m.lines = append(m.lines, "")
	if len(m.lines) > m.maxLines {
		m.lines = m.lines[len(m.lines)-m.maxLines:]
	}
}

func (m *plainTerminalModel) backspace() {
	current := []rune(m.current())
	if len(current) == 0 {
		return
	}
	m.setCurrent(string(current[:len(current)-1]))
}

func (m *plainTerminalModel) appendRune(r rune) {
	m.setCurrent(m.current() + string(r))
}

func (m *plainTerminalModel) Clear() {
	m.lines = []string{""}
}

func (m *plainTerminalModel) AppendPlain(text string) {
	for _, r := range text {
		switch r {
		case '\r':
			m.setCurrent("")
		case '\n':
			m.newline()
		case '\b':
			m.backspace()
		default:
			m.appendRune(r)
		}
	}
}

func (m *plainTerminalModel) Consume(input string) (string, bool) {
	var visible strings.Builder
	for i := 0; i < len(input); i++ {
		b := input[i]
		switch b {
		case '\x1b':
			if i+1 >= len(input) {
				continue
			}
			next := input[i+1]
			if next == '[' {
				final, sequence, nextIndex := parseCSISequence(input, i+2)
				i = nextIndex
				if requiresXtermFallbackForCSI(sequence, final) {
					return visible.String(), true
				}
				continue
			}
			if next == ']' {
				nextIndex := skipOSCSequence(input, i+2)
				if nextIndex < 0 {
					return visible.String(), true
				}
				i = nextIndex
				continue
			}
			// Ignore other short ESC sequences for now. Shell bootstrap output
			// commonly uses lightweight mode toggles that are safe to drop in
			// this plain-text renderer; falling back on every one of them makes
			// the Go host unusable for normal prompts.
			i++
			continue
		case '\r':
			m.setCurrent("")
			visible.WriteByte('\r')
		case '\n':
			m.newline()
			visible.WriteByte('\n')
		case '\b':
			m.backspace()
		default:
			m.appendRune(rune(b))
			visible.WriteByte(b)
		}
	}
	return visible.String(), false
}

func (m *plainTerminalModel) Text() string {
	return strings.Join(m.lines, "\n")
}

func parseCSISequence(input string, start int) (byte, string, int) {
	for i := start; i < len(input); i++ {
		final := input[i]
		if final >= 0x40 && final <= 0x7e {
			return final, input[start:i], i
		}
	}
	return 0, input[start:], len(input) - 1
}

func skipOSCSequence(input string, start int) int {
	for i := start; i < len(input); i++ {
		if input[i] == '\a' {
			return i
		}
		if input[i] == '\x1b' && i+1 < len(input) && input[i+1] == '\\' {
			return i + 1
		}
	}
	return -1
}

func requiresXtermFallbackForCSI(sequence string, final byte) bool {
	if strings.HasPrefix(sequence, "?1049") || strings.HasPrefix(sequence, "?47") {
		return true
	}
	if (final == 'h' || final == 'l') && strings.HasPrefix(sequence, "?1047") {
		return true
	}
	return false
}

func encodeKeyboardEvent(event js.Value) string {
	key := event.Get("key").String()
	ctrl := event.Get("ctrlKey").Bool()
	meta := event.Get("metaKey").Bool()
	alt := event.Get("altKey").Bool()
	if meta {
		return ""
	}

	if ctrl && len(key) == 1 {
		upper := strings.ToUpper(key)
		code := upper[0]
		if code >= 'A' && code <= 'Z' {
			return string(rune(code - 'A' + 1))
		}
	}

	switch key {
	case "Enter":
		return "\r"
	case "Tab":
		return "\t"
	case "Backspace":
		return "\x7f"
	case "Escape":
		return "\x1b"
	case "ArrowUp":
		return "\x1b[A"
	case "ArrowDown":
		return "\x1b[B"
	case "ArrowRight":
		return "\x1b[C"
	case "ArrowLeft":
		return "\x1b[D"
	case "Home":
		return "\x1b[H"
	case "End":
		return "\x1b[F"
	case "Delete":
		return "\x1b[3~"
	case "PageUp":
		return "\x1b[5~"
	case "PageDown":
		return "\x1b[6~"
	}

	if alt && len(key) == 1 {
		return "\x1b" + key
	}
	if len(key) == 1 {
		return key
	}
	return ""
}

func boolPtr(value bool) *bool { return &value }

func uint16Ptr(value uint16) *uint16 { return &value }

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}
