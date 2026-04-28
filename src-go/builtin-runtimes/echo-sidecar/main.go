// Builtin GreebleFS sidecar that exercises the universal runtime pipeline.
//
// Routes:
//   runtime.summary -> { language, version, runtimeId }
//   echo            -> returns the payload unchanged
//   now             -> { wallClock }
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"time"

	greeblefsRuntime "greeblefs.dev/sdk/greeblefs-go/runtime"
)

const runtimeID = "echo-sidecar"

func main() {
	server := greeblefsRuntime.NewSidecar()

	server.RegisterAction("runtime.summary", func(ctx context.Context, host *greeblefsRuntime.HostBridgeClient, payload json.RawMessage) (any, error) {
		_ = host
		return map[string]any{
			"runtimeId":   runtimeID,
			"language":    "go",
			"goVersion":   runtime.Version(),
			"goos":        runtime.GOOS,
			"goarch":      runtime.GOARCH,
			"description": "GreebleFS universal runtime pipeline reference sidecar.",
		}, nil
	})

	server.RegisterAction("echo", func(ctx context.Context, host *greeblefsRuntime.HostBridgeClient, payload json.RawMessage) (any, error) {
		_ = host
		var anyPayload any
		if len(payload) > 0 {
			if err := json.Unmarshal(payload, &anyPayload); err != nil {
				return nil, fmt.Errorf("failed to decode echo payload: %w", err)
			}
		}
		return map[string]any{"echo": anyPayload}, nil
	})

	server.RegisterAction("now", func(ctx context.Context, host *greeblefsRuntime.HostBridgeClient, payload json.RawMessage) (any, error) {
		_ = host
		return map[string]any{"wallClock": time.Now().UTC().Format(time.RFC3339Nano)}, nil
	})

	if err := server.Serve(); err != nil {
		fmt.Fprintf(os.Stderr, "%s: serve loop failed: %v\n", runtimeID, err)
		os.Exit(1)
	}
}
