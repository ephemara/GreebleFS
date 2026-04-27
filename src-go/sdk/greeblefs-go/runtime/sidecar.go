// Package runtime provides high-level helpers for authoring GreebleFS
// `native-sidecar` and `native-command` runtimes.
//
// Sidecar pattern:
//
//	server := runtime.NewSidecar()
//	server.RegisterAction("echo", func(ctx context.Context, payload json.RawMessage) (any, error) {
//	    return map[string]any{"ok": true}, nil
//	})
//	if err := server.Serve(); err != nil { ... }
package runtime

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"greeblefs.dev/sdk/greeblefs-go/ipc"
)

// ActionHandler runs a single sidecar action. The host has already decoded
// the payload from JSON when one is present; raw JSON is passed through so
// handlers can choose their own typed decode strategy.
type ActionHandler func(ctx context.Context, payload json.RawMessage) (any, error)

// Sidecar is the top-level state for an authored GreebleFS Go sidecar.
type Sidecar struct {
	actions map[string]ActionHandler
	stdin   io.Reader
	stdout  io.Writer
	stderr  io.Writer
}

// NewSidecar wires a sidecar against process stdio. Tests should use
// NewSidecarWithStreams.
func NewSidecar() *Sidecar {
	return NewSidecarWithStreams(os.Stdin, os.Stdout, os.Stderr)
}

// NewSidecarWithStreams allows redirecting the wire I/O for testing.
func NewSidecarWithStreams(stdin io.Reader, stdout io.Writer, stderr io.Writer) *Sidecar {
	return &Sidecar{
		actions: make(map[string]ActionHandler),
		stdin:   stdin,
		stdout:  stdout,
		stderr:  stderr,
	}
}

// RegisterAction adds (or replaces) a typed action handler.
func (s *Sidecar) RegisterAction(actionID string, handler ActionHandler) {
	s.actions[actionID] = handler
}

// Serve consumes one JSON-line per request until the stream ends or the host
// sends a shutdown packet. Errors that occur for a single request are
// reported in-line; only fatal stream errors return from Serve.
func (s *Sidecar) Serve() error {
	scanner := bufio.NewScanner(s.stdin)
	scanner.Buffer(make([]byte, 0, 1024*1024), 16*1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var request ipc.Request
		if err := json.Unmarshal(line, &request); err != nil {
			s.writeError("decode-error", fmt.Sprintf("failed to decode request: %v", err))
			continue
		}
		if request.Kind == ipc.KindShutdown {
			return nil
		}
		if request.Kind != ipc.KindCall {
			s.writeError(request.RequestID, fmt.Sprintf("unsupported request kind: %s", request.Kind))
			continue
		}
		if request.ActionID == nil {
			s.writeError(request.RequestID, "request is missing actionId")
			continue
		}
		handler, ok := s.actions[*request.ActionID]
		if !ok {
			s.writeError(request.RequestID, fmt.Sprintf("unknown action: %s", *request.ActionID))
			continue
		}
		var payload json.RawMessage
		if request.PayloadJSON != nil && *request.PayloadJSON != "" {
			payload = json.RawMessage(*request.PayloadJSON)
		}
		result, err := handler(context.Background(), payload)
		if err != nil {
			s.writeError(request.RequestID, err.Error())
			continue
		}
		s.writeResult(request.RequestID, result)
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("sidecar stdin scan failed: %w", err)
	}
	return nil
}

func (s *Sidecar) writeResult(requestID string, value any) {
	encoded, err := json.Marshal(value)
	if err != nil {
		s.writeError(requestID, fmt.Sprintf("failed to encode action result: %v", err))
		return
	}
	resultStr := string(encoded)
	response := ipc.Response{RequestID: requestID, OK: true, ResultJSON: &resultStr}
	s.emit(response)
}

func (s *Sidecar) writeError(requestID string, message string) {
	msg := message
	response := ipc.Response{RequestID: requestID, OK: false, Error: &msg}
	s.emit(response)
}

func (s *Sidecar) emit(response ipc.Response) {
	encoded, err := json.Marshal(response)
	if err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to encode response: %v\n", err)
		return
	}
	encoded = append(encoded, '\n')
	if _, err := s.stdout.Write(encoded); err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to write response: %v\n", err)
	}
}
