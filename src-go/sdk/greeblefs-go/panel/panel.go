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

// yieldToHost gives the JS event loop a tick to flush a pending React commit.
// Used while waiting for the host to paint `data-bridge-token` after boot.
func yieldToHost() {
	done := make(chan struct{}, 1)
	cb := js.FuncOf(func(this js.Value, args []js.Value) any {
		done <- struct{}{}
		return nil
	})
	defer cb.Release()
	js.Global().Call("setTimeout", cb, 0)
	<-done
}

// Run is the canonical entrypoint for `wasm-panel` runtimes. It hooks up the
// host bridge, locates the panel root the React host installed, calls the
// caller's MountFunc, and parks the goroutine until shutdown.
func Run(mount MountFunc) error {
	bridge, err := hostapi.NewBridge()
	if err != nil {
		return err
	}
	// Look up *this* panel's host element by its bridge token. The React
	// host stamps `data-bridge-token="<token>"` on the mount root so that
	// multiple panels of the same runtime id can mount side by side without
	// collapsing into the first matching `[data-runtime-id]` element.
	tokenSelector := `[data-bridge-token="` + bridge.Token() + `"]`
	rootElement := js.Global().Get("document").Call("querySelector", tokenSelector)
	if rootElement.IsNull() || rootElement.IsUndefined() {
		// Spin briefly to absorb the React commit that paints the
		// `data-bridge-token` attribute. The host renders the attribute as
		// soon as the bridge token is registered, so a single yielded tick
		// is normally enough.
		for i := 0; i < 16; i++ {
			rootElement = js.Global().Get("document").Call("querySelector", tokenSelector)
			if !rootElement.IsNull() && !rootElement.IsUndefined() {
				break
			}
			yieldToHost()
		}
	}
	if rootElement.IsNull() || rootElement.IsUndefined() {
		return errors.New("greeblefs panel: panel host element was not located for bridge token")
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
