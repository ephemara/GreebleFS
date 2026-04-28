// Sample wasm-panel runtime. It doubles as the canonical smoke-test surface
// for the Go/Wasm panel lane:
//
//   - local interactive state stored through the host bridge
//   - live host event subscriptions for selection/preview/cwd changes
//   - typed host-service calls for snapshot refresh
//
// The implementation stays intentionally dependency-light so future authors
// can copy it as a minimal reference without dragging a frontend framework
// into their runtime.
//
//go:build js && wasm
// +build js,wasm

package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"syscall/js"

	"greeblefs.dev/sdk/greeblefs-go/hostapi"
	"greeblefs.dev/sdk/greeblefs-go/panel"
)

func main() {
	if err := panel.Run(renderSamplePanel); err != nil {
		fmt.Println("sample-panel runtime exited with error:", err)
	}
}

type smokePanelStorage struct {
	Counter int `json:"counter"`
}

type smokePanelState struct {
	Counter        int
	CWD            string
	FocusedPath    string
	PreviewPath    string
	FileType       string
	Revision       string
	EventCount     int
	LastTopic      string
	LastError      string
	RecentMessages []string
}

type smokePanelUI struct {
	counterValue    js.Value
	cwdValue        js.Value
	focusedValue    js.Value
	previewValue    js.Value
	fileTypeValue   js.Value
	revisionValue   js.Value
	eventCountValue js.Value
	lastTopicValue  js.Value
	eventList       js.Value
	errorValue      js.Value
}

func renderSamplePanel(mount panel.Mount) (panel.Unmount, error) {
	document := js.Global().Get("document")
	services := mount.Bridge.Services()
	stored := readStoredState(mount.Bridge)
	state := &smokePanelState{
		Counter:        stored.Counter,
		CWD:            "Waiting for host context...",
		FocusedPath:    "Nothing selected yet",
		PreviewPath:    "No preview session yet",
		FileType:       "unknown",
		Revision:       "pending",
		EventCount:     0,
		LastTopic:      "boot",
		RecentMessages: []string{"booting Go/Wasm smoke panel"},
	}

	hostCard := createElement(document, "div", map[string]string{
		"display":       "flex",
		"flexDirection": "column",
		"gap":           "14px",
		"height":        "100%",
		"boxSizing":     "border-box",
		"padding":       "14px",
		"fontFamily":    "system-ui, sans-serif",
		"fontSize":      "13px",
		"color":         "var(--overlay-text-primary, #f5f5f5)",
		"background":    "linear-gradient(180deg, rgba(80, 200, 255, 0.10), transparent 28%), var(--overlay-bg-panel-alt, #10131a)",
		"overflow":      "hidden",
	})
	hero := createElement(document, "div", map[string]string{
		"display":        "flex",
		"justifyContent": "space-between",
		"alignItems":     "flex-start",
		"gap":            "14px",
		"padding":        "14px",
		"borderRadius":   "16px",
		"border":         "1px solid rgba(255, 255, 255, 0.10)",
		"background":     "rgba(255, 255, 255, 0.03)",
	})
	titleColumn := createElement(document, "div", map[string]string{
		"display": "grid",
		"gap":     "6px",
	})
	title := createElement(document, "div", map[string]string{
		"fontSize":   "16px",
		"fontWeight": "700",
	}, "Go/Wasm Smoke Panel")
	subtitle := createElement(document, "div", map[string]string{
		"fontSize":   "12px",
		"opacity":    "0.72",
		"lineHeight": "1.5",
	}, "Interactive runtime reference: local state, host snapshots, and pushed explorer events.")
	statusRow := createElement(document, "div", map[string]string{
		"display":   "flex",
		"flexWrap":  "wrap",
		"gap":       "8px",
		"marginTop": "6px",
	})
	counterPill := createPill(document, "Counter")
	eventPill := createPill(document, "Events")
	runtimePill := createPill(document, "sample-panel")
	statusRow.Call("appendChild", counterPill)
	statusRow.Call("appendChild", eventPill)
	statusRow.Call("appendChild", runtimePill)
	titleColumn.Call("appendChild", title)
	titleColumn.Call("appendChild", subtitle)
	titleColumn.Call("appendChild", statusRow)

	actions := createElement(document, "div", map[string]string{
		"display":        "flex",
		"flexWrap":       "wrap",
		"gap":            "8px",
		"justifyContent": "flex-end",
	})
	incrementButton := createButton(document, "Increment counter")
	resetButton := createButton(document, "Reset")
	refreshButton := createButton(document, "Refresh snapshot")
	actions.Call("appendChild", incrementButton)
	actions.Call("appendChild", resetButton)
	actions.Call("appendChild", refreshButton)

	hero.Call("appendChild", titleColumn)
	hero.Call("appendChild", actions)

	statsGrid := createElement(document, "div", map[string]string{
		"display":             "grid",
		"gridTemplateColumns": "repeat(auto-fit, minmax(180px, 1fr))",
		"gap":                 "10px",
	})

	counterValue := createStatCard(document, statsGrid, "Persisted Counter")
	cwdValue := createStatCard(document, statsGrid, "Current CWD")
	focusedValue := createStatCard(document, statsGrid, "Focused Entry")
	previewValue := createStatCard(document, statsGrid, "Preview Session")
	fileTypeValue := createStatCard(document, statsGrid, "Active File Type")
	revisionValue := createStatCard(document, statsGrid, "Context Revision")

	activityCard := createElement(document, "div", map[string]string{
		"display":      "grid",
		"gap":          "10px",
		"padding":      "14px",
		"borderRadius": "16px",
		"border":       "1px solid rgba(255, 255, 255, 0.08)",
		"background":   "rgba(255, 255, 255, 0.02)",
		"minHeight":    "0",
		"flex":         "1",
		"overflow":     "hidden",
	})
	activityHeader := createElement(document, "div", map[string]string{
		"display":        "flex",
		"justifyContent": "space-between",
		"alignItems":     "center",
		"gap":            "12px",
	})
	activityTitle := createElement(document, "div", map[string]string{
		"fontSize":      "13px",
		"fontWeight":    "700",
		"textTransform": "uppercase",
		"letterSpacing": "0.08em",
		"opacity":       "0.82",
	}, "Live Host Activity")
	lastTopicValue := createElement(document, "div", map[string]string{
		"fontSize": "11px",
		"opacity":  "0.68",
	}, "")
	activityHeader.Call("appendChild", activityTitle)
	activityHeader.Call("appendChild", lastTopicValue)

	errorValue := createElement(document, "div", map[string]string{
		"fontSize":   "12px",
		"lineHeight": "1.5",
		"color":      "var(--overlay-danger, #ff8a8a)",
		"display":    "none",
	})
	eventList := createElement(document, "div", map[string]string{
		"display":      "grid",
		"gap":          "8px",
		"overflow":     "auto",
		"paddingRight": "6px",
	})
	activityCard.Call("appendChild", activityHeader)
	activityCard.Call("appendChild", errorValue)
	activityCard.Call("appendChild", eventList)

	hostCard.Call("appendChild", hero)
	hostCard.Call("appendChild", statsGrid)
	hostCard.Call("appendChild", activityCard)
	mount.Root.Call("appendChild", hostCard)

	ui := smokePanelUI{
		counterValue:    counterValue,
		cwdValue:        cwdValue,
		focusedValue:    focusedValue,
		previewValue:    previewValue,
		fileTypeValue:   fileTypeValue,
		revisionValue:   revisionValue,
		eventCountValue: eventPill,
		lastTopicValue:  lastTopicValue,
		eventList:       eventList,
		errorValue:      errorValue,
	}

	render := func() {
		counterPill.Set("textContent", fmt.Sprintf("Counter %d", state.Counter))
		eventPill.Set("textContent", fmt.Sprintf("%d host events", state.EventCount))
		counterValue.Set("textContent", fmt.Sprintf("%d", state.Counter))
		cwdValue.Set("textContent", state.CWD)
		focusedValue.Set("textContent", state.FocusedPath)
		previewValue.Set("textContent", state.PreviewPath)
		fileTypeValue.Set("textContent", state.FileType)
		revisionValue.Set("textContent", state.Revision)
		lastTopicValue.Set("textContent", state.LastTopic)
		if strings.TrimSpace(state.LastError) == "" {
			ui.errorValue.Get("style").Set("display", "none")
			ui.errorValue.Set("textContent", "")
		} else {
			ui.errorValue.Get("style").Set("display", "block")
			ui.errorValue.Set("textContent", state.LastError)
		}
		renderEventMessages(document, ui.eventList, state.RecentMessages)
	}

	recordMessage := func(message string) {
		message = strings.TrimSpace(message)
		if message == "" {
			return
		}
		state.RecentMessages = append([]string{message}, state.RecentMessages...)
		if len(state.RecentMessages) > 8 {
			state.RecentMessages = state.RecentMessages[:8]
		}
	}

	applySnapshot := func(snapshot *hostapi.ExecutionContextSnapshot) {
		if snapshot == nil {
			return
		}
		state.Revision = fallbackString(snapshot.Revision, "pending")
		state.CWD = resolveCWD(snapshot)
		state.FocusedPath = resolveFocusedPath(snapshot)
		state.PreviewPath = resolvePreviewPath(snapshot)
		state.FileType = resolveFileType(snapshot)
	}

	handleSnapshotRefresh := func(source string) {
		snapshot, err := services.Selection.GetSnapshot()
		if err != nil {
			state.LastError = err.Error()
			recordMessage(fmt.Sprintf("%s failed: %v", source, err))
			render()
			return
		}
		state.LastError = ""
		state.LastTopic = source
		applySnapshot(&snapshot)
		recordMessage(fmt.Sprintf("%s -> %s", source, compactPath(resolveFocusedPath(&snapshot))))
		render()
	}

	handleHostEvent := func(envelope hostapi.HostEventEnvelope) {
		state.EventCount++
		state.LastTopic = envelope.Topic
		if envelope.ExecutionContext != nil {
			applySnapshot(envelope.ExecutionContext)
		}
		recordMessage(formatHostEventMessage(envelope))
		render()
	}

	incrementCallback := js.FuncOf(func(this js.Value, args []js.Value) any {
		state.Counter++
		state.LastError = ""
		writeStoredState(mount.Bridge, smokePanelStorage{Counter: state.Counter})
		mount.Bridge.EmitEvent("host-event", map[string]any{
			"name": "smoke.counter.incremented",
			"payload": map[string]any{
				"counter": state.Counter,
			},
		})
		recordMessage(fmt.Sprintf("counter incremented -> %d", state.Counter))
		render()
		return nil
	})
	resetCallback := js.FuncOf(func(this js.Value, args []js.Value) any {
		state.Counter = 0
		state.LastError = ""
		writeStoredState(mount.Bridge, smokePanelStorage{Counter: state.Counter})
		mount.Bridge.EmitEvent("host-event", map[string]any{
			"name": "smoke.counter.reset",
			"payload": map[string]any{
				"counter": state.Counter,
			},
		})
		recordMessage("counter reset")
		render()
		return nil
	})
	refreshCallback := js.FuncOf(func(this js.Value, args []js.Value) any {
		handleSnapshotRefresh("selection.get_snapshot")
		return nil
	})
	incrementButton.Call("addEventListener", "click", incrementCallback)
	resetButton.Call("addEventListener", "click", resetCallback)
	refreshButton.Call("addEventListener", "click", refreshCallback)

	subscriptionID := ""
	subscription, err := services.Events.Subscribe(hostapi.HostSubscriptionRequest{
		Topics:          []string{"selection.changed", "preview.session.changed", "cwd.changed"},
		IncludeSnapshot: true,
	}, func(envelope hostapi.HostEventEnvelope) {
		handleHostEvent(envelope)
	})
	if err != nil {
		state.LastError = err.Error()
		recordMessage(fmt.Sprintf("events.subscribe failed: %v", err))
	} else {
		subscriptionID = subscription.SubscriptionID
		recordMessage("events.subscribe -> live")
	}

	handleSnapshotRefresh("initial snapshot")
	render()

	return func() {
		if subscriptionID != "" {
			_ = services.Events.Unsubscribe(subscriptionID)
		}
		incrementCallback.Release()
		resetCallback.Release()
		refreshCallback.Release()
		mount.Root.Call("removeChild", hostCard)
	}, nil
}

func readStoredState(bridge *hostapi.Bridge) smokePanelStorage {
	raw := strings.TrimSpace(bridge.ReadStorageBlob())
	if raw == "" {
		return smokePanelStorage{}
	}
	var stored smokePanelStorage
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return smokePanelStorage{}
	}
	return stored
}

func writeStoredState(bridge *hostapi.Bridge, stored smokePanelStorage) {
	encoded, err := json.Marshal(stored)
	if err != nil {
		return
	}
	bridge.WriteStorageBlob(string(encoded))
}

func createElement(document js.Value, tag string, styles map[string]string, text ...string) js.Value {
	element := document.Call("createElement", tag)
	for key, value := range styles {
		element.Get("style").Set(key, value)
	}
	if len(text) > 0 {
		element.Set("textContent", text[0])
	}
	return element
}

func createButton(document js.Value, label string) js.Value {
	return createElement(document, "button", map[string]string{
		"borderRadius": "10px",
		"border":       "1px solid rgba(255, 255, 255, 0.10)",
		"background":   "rgba(255, 255, 255, 0.06)",
		"color":        "var(--overlay-text-primary, #f5f5f5)",
		"padding":      "8px 12px",
		"fontSize":     "12px",
		"fontWeight":   "600",
		"cursor":       "pointer",
	}, label)
}

func createPill(document js.Value, text string) js.Value {
	return createElement(document, "div", map[string]string{
		"borderRadius": "999px",
		"padding":      "6px 10px",
		"fontSize":     "11px",
		"border":       "1px solid rgba(255, 255, 255, 0.08)",
		"background":   "rgba(255, 255, 255, 0.04)",
	}, text)
}

func createStatCard(document js.Value, grid js.Value, label string) js.Value {
	card := createElement(document, "div", map[string]string{
		"display":      "grid",
		"gap":          "8px",
		"padding":      "12px",
		"borderRadius": "14px",
		"border":       "1px solid rgba(255, 255, 255, 0.08)",
		"background":   "rgba(255, 255, 255, 0.02)",
		"minWidth":     "0",
	})
	labelNode := createElement(document, "div", map[string]string{
		"fontSize":      "11px",
		"textTransform": "uppercase",
		"letterSpacing": "0.08em",
		"opacity":       "0.68",
	}, label)
	valueNode := createElement(document, "div", map[string]string{
		"fontSize":   "13px",
		"lineHeight": "1.5",
		"wordBreak":  "break-word",
	}, "—")
	card.Call("appendChild", labelNode)
	card.Call("appendChild", valueNode)
	grid.Call("appendChild", card)
	return valueNode
}

func renderEventMessages(document js.Value, host js.Value, messages []string) {
	host.Set("innerHTML", "")
	for _, message := range messages {
		row := createElement(document, "div", map[string]string{
			"padding":      "10px 12px",
			"borderRadius": "12px",
			"border":       "1px solid rgba(255, 255, 255, 0.06)",
			"background":   "rgba(255, 255, 255, 0.02)",
			"fontSize":     "12px",
			"lineHeight":   "1.5",
			"wordBreak":    "break-word",
		}, message)
		host.Call("appendChild", row)
	}
}

func resolveCWD(snapshot *hostapi.ExecutionContextSnapshot) string {
	if snapshot == nil {
		return "Waiting for host context..."
	}
	if snapshot.CWD != nil && strings.TrimSpace(*snapshot.CWD) != "" {
		return *snapshot.CWD
	}
	if snapshot.ActiveDirectory != nil && strings.TrimSpace(*snapshot.ActiveDirectory) != "" {
		return *snapshot.ActiveDirectory
	}
	return "No cwd yet"
}

func resolveFocusedPath(snapshot *hostapi.ExecutionContextSnapshot) string {
	if snapshot == nil {
		return "Nothing selected yet"
	}
	if snapshot.FocusedEntry != nil && strings.TrimSpace(snapshot.FocusedEntry.Path) != "" {
		return snapshot.FocusedEntry.Path
	}
	if len(snapshot.SelectedEntries) > 0 && strings.TrimSpace(snapshot.SelectedEntries[0].Path) != "" {
		return snapshot.SelectedEntries[0].Path
	}
	return "Nothing selected yet"
}

func resolvePreviewPath(snapshot *hostapi.ExecutionContextSnapshot) string {
	if snapshot == nil || snapshot.PreviewSession == nil {
		return "No preview session yet"
	}
	if snapshot.PreviewSession.FilePath != nil && strings.TrimSpace(*snapshot.PreviewSession.FilePath) != "" {
		return *snapshot.PreviewSession.FilePath
	}
	if snapshot.PreviewSession.ResolvedPath != nil && strings.TrimSpace(*snapshot.PreviewSession.ResolvedPath) != "" {
		return *snapshot.PreviewSession.ResolvedPath
	}
	if snapshot.PreviewSession.LaneType != "" {
		return snapshot.PreviewSession.LaneType
	}
	return "No preview session yet"
}

func resolveFileType(snapshot *hostapi.ExecutionContextSnapshot) string {
	if snapshot == nil || snapshot.ActiveFileType == nil {
		return "unknown"
	}
	fileType := snapshot.ActiveFileType
	if strings.TrimSpace(fileType.ID) != "" {
		return fileType.ID
	}
	if fileType.LanguageID != nil && strings.TrimSpace(*fileType.LanguageID) != "" {
		return *fileType.LanguageID
	}
	if len(fileType.Extensions) > 0 {
		return strings.Join(fileType.Extensions, ", ")
	}
	return fileType.OpenBehavior
}

func compactPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return "unknown"
	}
	base := filepath.Base(path)
	if base == "." || base == "/" || base == "\\" {
		return path
	}
	return base
}

func formatHostEventMessage(envelope hostapi.HostEventEnvelope) string {
	source := envelope.Topic
	if envelope.Snapshot {
		source += " [snapshot]"
	}
	if envelope.ExecutionContext != nil {
		if previewPath := resolvePreviewPath(envelope.ExecutionContext); previewPath != "No preview session yet" && previewPath != "" {
			return fmt.Sprintf("%s -> preview %s", source, compactPath(previewPath))
		}
		if focusedPath := resolveFocusedPath(envelope.ExecutionContext); focusedPath != "Nothing selected yet" && focusedPath != "" {
			return fmt.Sprintf("%s -> %s", source, compactPath(focusedPath))
		}
		if cwd := resolveCWD(envelope.ExecutionContext); cwd != "No cwd yet" && cwd != "Waiting for host context..." && cwd != "" {
			return fmt.Sprintf("%s -> cwd %s", source, compactPath(cwd))
		}
	}
	if envelope.PayloadJSON != nil && strings.TrimSpace(*envelope.PayloadJSON) != "" {
		return fmt.Sprintf("%s -> %s", source, *envelope.PayloadJSON)
	}
	return source
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
