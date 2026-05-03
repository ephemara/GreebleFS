// Package hostapi exposes the typed host bridge surface to GreebleFS Go
// `wasm-panel` runtimes. Native sidecars/commands talk to the host through
// the JSON-lines protocol in `runtime`; this package is exclusively for
// in-webview Wasm panels which run alongside the React host bridge.
//
//go:build js && wasm
// +build js,wasm

package hostapi

import (
	"errors"
	"os"
	"syscall/js"
)

// Bridge resolves the host-side bridge object the React shell installed on
// `window.__greeblefsRuntimeHostBridge`. The boot flag --bridge-token=<id>
// is parsed from the Go process arguments.
type Bridge struct {
	token          string
	value          js.Value
	context        js.Value
	eventCallbacks map[string]js.Func
}

// NewBridge inspects the process arguments installed by the React host and
// resolves a typed bridge handle. Returns an error if the bridge cannot be
// located, in which case the caller should fall back to a degraded UI.
func NewBridge() (*Bridge, error) {
	token := parseBridgeToken()
	if token == "" {
		return nil, errors.New("greeblefs hostapi: --bridge-token argument missing")
	}
	registry := js.Global().Get("__greeblefsRuntimeHostBridge")
	if registry.IsUndefined() || registry.IsNull() {
		return nil, errors.New("greeblefs hostapi: host bridge registry is not installed")
	}
	entry := registry.Get(token)
	if entry.IsUndefined() || entry.IsNull() {
		return nil, errors.New("greeblefs hostapi: bridge token has no entry")
	}
	bridge := entry.Get("bridge")
	context := entry.Get("context")
	if bridge.IsUndefined() || bridge.IsNull() {
		return nil, errors.New("greeblefs hostapi: bridge entry has no bridge value")
	}
	return &Bridge{
		token:          token,
		value:          bridge,
		context:        context,
		eventCallbacks: make(map[string]js.Func),
	}, nil
}

// Token returns the bridge token used during boot. Useful for logging.
func (b *Bridge) Token() string { return b.token }

// Context returns the host context object as a raw js.Value. Authors are
// expected to read named fields (themeId, panelId, cssVariables, etc.).
func (b *Bridge) Context() js.Value { return b.context }

// EmitEvent forwards a typed event from the runtime to the host shell.
// `kind` matches the GoPanelHostEvent discriminant in `GoPanelHost.tsx`.
func (b *Bridge) EmitEvent(kind string, payload map[string]any) {
	event := map[string]any{"kind": kind}
	for k, v := range payload {
		event[k] = v
	}
	b.value.Call("emitEvent", toJSValue(event))
}

// CallRuntimeAction calls a typed action on a *peer* runtime (typically a
// `native-sidecar`) through the host's universal pipeline. `wasm-panel`
// runtimes never call into themselves — they handle UI in-process — so the
// target runtime id is required. Returns the resolved `result` object as a
// js.Value; the caller decides how to decode it.
func (b *Bridge) CallRuntimeAction(targetRuntimeID, actionID string, payload any) (js.Value, error) {
	if targetRuntimeID == "" {
		return js.Undefined(), errors.New("greeblefs hostapi: targetRuntimeID is required")
	}
	promise := b.value.Call("callRuntimeAction", targetRuntimeID, actionID, toJSValue(payload))
	return awaitPromise(promise)
}

// ReadStorageBlob returns the persisted blob for this runtime, or an empty
// string if nothing was stored yet.
func (b *Bridge) ReadStorageBlob() string {
	value := b.value.Call("readStorageBlob")
	if value.IsNull() || value.IsUndefined() {
		return ""
	}
	return value.String()
}

// WriteStorageBlob persists a blob for this runtime. Pass an empty string to
// clear the storage entry.
func (b *Bridge) WriteStorageBlob(next string) {
	if next == "" {
		b.value.Call("writeStorageBlob", js.Null())
		return
	}
	b.value.Call("writeStorageBlob", next)
}

// parseBridgeToken pulls the `--bridge-token=<id>` argument out of os.Args
// without disturbing any other flag parsing the runtime author may want.
func parseBridgeToken() string {
	return parseBridgeTokenFromArgs(rawArgsAfterProgram())
}

func rawArgsAfterProgram() []string {
	if len(os.Args) > 1 {
		return append([]string(nil), os.Args[1:]...)
	}

	global := js.Global()
	process := global.Get("process")
	if !process.IsUndefined() && !process.IsNull() {
		argv := process.Get("argv")
		if argv.Type() == js.TypeObject && argv.Length() > 1 {
			args := make([]string, 0, argv.Length()-1)
			for i := 1; i < argv.Length(); i++ {
				args = append(args, argv.Index(i).String())
			}
			return args
		}
	}
	return nil
}

func toJSValue(value any) js.Value {
	if value == nil {
		return js.Null()
	}
	switch v := value.(type) {
	case js.Value:
		return v
	case string:
		return js.ValueOf(v)
	case bool:
		return js.ValueOf(v)
	case int:
		return js.ValueOf(v)
	case int64:
		return js.ValueOf(v)
	case float64:
		return js.ValueOf(v)
	case map[string]any:
		obj := js.Global().Get("Object").New()
		for k, raw := range v {
			obj.Set(k, toJSValue(raw))
		}
		return obj
	case []any:
		arr := js.Global().Get("Array").New(len(v))
		for i, raw := range v {
			arr.SetIndex(i, toJSValue(raw))
		}
		return arr
	default:
		return js.ValueOf(v)
	}
}

func awaitPromise(promise js.Value) (js.Value, error) {
	type result struct {
		value js.Value
		err   error
	}
	done := make(chan result, 1)
	thenFn := js.FuncOf(func(this js.Value, args []js.Value) any {
		var value js.Value
		if len(args) > 0 {
			value = args[0]
		}
		done <- result{value: value}
		return nil
	})
	defer thenFn.Release()
	catchFn := js.FuncOf(func(this js.Value, args []js.Value) any {
		message := "host runtime call rejected"
		if len(args) > 0 {
			message = args[0].String()
		}
		done <- result{err: errors.New(message)}
		return nil
	})
	defer catchFn.Release()
	promise.Call("then", thenFn).Call("catch", catchFn)
	r := <-done
	return r.value, r.err
}
