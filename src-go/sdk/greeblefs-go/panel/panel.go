// Package panel offers tiny helpers for `wasm-panel` runtimes. The host
// already mounts the runtime against a known DOM root and feeds typed
// context/events through `hostapi`; this package keeps the boot story
// short for authored panels.
//
//go:build js && wasm
// +build js,wasm

package panel

import (
	"errors"
	"syscall/js"

	"greeblefs.dev/sdk/greeblefs-go/hostapi"
)

// Mount runs an authored panel against the host bridge. It blocks the Go
// goroutine until the host or the panel signals a shutdown via `onUnmount`.
type Mount struct {
	Bridge *hostapi.Bridge
	Root   js.Value
}

// MountFunc renders a panel against a host-provided DOM root.
type MountFunc func(mount Mount) (Unmount, error)

// Unmount lets the host clean up listeners/refs when the panel is being torn
// down. The host always invokes this exactly once.
type Unmount func()

// Run is the canonical entrypoint for `wasm-panel` runtimes. It hooks up the
// host bridge, locates the panel root the React host installed, calls the
// caller's MountFunc, and parks the goroutine until shutdown.
func Run(mount MountFunc) error {
	bridge, err := hostapi.NewBridge()
	if err != nil {
		return err
	}
	rootElement := js.Global().Get("document").Call("querySelector", `[data-runtime-id="`+bridge.Token()+`"]`)
	if rootElement.IsNull() || rootElement.IsUndefined() {
		// Fallback to the first ready panel host element.
		rootElement = js.Global().Get("document").Call("querySelector", `[data-runtime-id]`)
		if rootElement.IsNull() || rootElement.IsUndefined() {
			return errors.New("greeblefs panel: no panel root element was located")
		}
	}
	if mount == nil {
		return errors.New("greeblefs panel: MountFunc must be non-nil")
	}
	unmount, err := mount(Mount{Bridge: bridge, Root: rootElement})
	if err != nil {
		return err
	}
	bridge.EmitEvent("ready", nil)
	stop := make(chan struct{})
	js.Global().Call("addEventListener", "beforeunload", js.FuncOf(func(this js.Value, args []js.Value) any {
		close(stop)
		return nil
	}))
	<-stop
	if unmount != nil {
		unmount()
	}
	return nil
}
