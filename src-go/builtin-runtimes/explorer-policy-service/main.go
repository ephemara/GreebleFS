package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	greeblefsRuntime "greeblefs.dev/sdk/greeblefs-go/runtime"
)

const explorerPolicyRuntimeID = "explorer-policy-service"

func main() {
	server := greeblefsRuntime.NewSidecar()
	service := newExplorerPolicyService()

	server.RegisterAction("explorer.session.bootstrap", func(
		ctx context.Context,
		host *greeblefsRuntime.HostBridgeClient,
		payload json.RawMessage,
	) (any, error) {
		_ = ctx
		_ = host
		var request explorerPolicyBootstrapRequest
		if err := json.Unmarshal(payload, &request); err != nil {
			return nil, fmt.Errorf("failed to decode bootstrap request: %w", err)
		}
		return service.bootstrap(request), nil
	})

	server.RegisterAction("explorer.session.navigate", func(
		ctx context.Context,
		host *greeblefsRuntime.HostBridgeClient,
		payload json.RawMessage,
	) (any, error) {
		_ = ctx
		var request explorerPolicyNavigateRequest
		if err := json.Unmarshal(payload, &request); err != nil {
			return nil, fmt.Errorf("failed to decode navigate request: %w", err)
		}
		return service.navigate(host, request)
	})

	server.RegisterAction("explorer.entry.resolve_open", func(
		ctx context.Context,
		host *greeblefsRuntime.HostBridgeClient,
		payload json.RawMessage,
	) (any, error) {
		_ = ctx
		var request explorerPolicyResolveOpenEntryRequest
		if err := json.Unmarshal(payload, &request); err != nil {
			return nil, fmt.Errorf("failed to decode open-entry request: %w", err)
		}
		return service.resolveOpenEntry(host, request)
	})

	if err := server.Serve(); err != nil {
		fmt.Fprintf(os.Stderr, "%s: serve loop failed: %v\n", explorerPolicyRuntimeID, err)
		os.Exit(1)
	}
}
