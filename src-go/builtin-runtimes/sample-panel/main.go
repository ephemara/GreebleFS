// Sample wasm-panel runtime. Renders a tiny status surface inside the host
// DOM root so the universal runtime pipeline has an authored proof-of-life
// example without dragging in heavy UI dependencies.
//
//go:build js && wasm
// +build js,wasm

package main

import (
	"fmt"
	"syscall/js"
	"time"

	"greeblefs.dev/sdk/greeblefs-go/panel"
)

func main() {
	if err := panel.Run(renderSamplePanel); err != nil {
		fmt.Println("sample-panel runtime exited with error:", err)
	}
}

func renderSamplePanel(mount panel.Mount) (panel.Unmount, error) {
	document := js.Global().Get("document")
	container := document.Call("createElement", "div")
	container.Get("style").Set("padding", "12px")
	container.Get("style").Set("fontFamily", "system-ui, sans-serif")
	container.Get("style").Set("fontSize", "13px")
	container.Set("innerHTML", "<strong>Sample Go panel</strong>")

	clock := document.Call("createElement", "div")
	clock.Get("style").Set("opacity", "0.7")
	clock.Get("style").Set("marginTop", "8px")
	container.Call("appendChild", clock)

	mount.Root.Call("appendChild", container)

	stop := make(chan struct{})
	ticker := time.NewTicker(time.Second)
	go func() {
		for {
			select {
			case t := <-ticker.C:
				clock.Set("textContent", "Wall clock: "+t.Format(time.RFC3339))
			case <-stop:
				return
			}
		}
	}()

	return func() {
		ticker.Stop()
		close(stop)
		mount.Root.Call("removeChild", container)
	}, nil
}
