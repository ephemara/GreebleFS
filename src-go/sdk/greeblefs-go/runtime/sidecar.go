// Package runtime provides high-level helpers for authoring GreebleFS
// `native-sidecar` and `native-command` runtimes.
//
// Sidecar pattern:
//
//	server := runtime.NewSidecar()
//	server.RegisterAction("echo", func(ctx context.Context, host *runtime.HostBridgeClient, payload json.RawMessage) (any, error) {
//	    _ = host
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
	"strings"

	"greeblefs.dev/sdk/greeblefs-go/ipc"
)

// ActionHandler runs one sidecar action. The host bridge allows handlers to
// synchronously request typed work from the native host without going back
// through TypeScript as a broker.
type ActionHandler func(ctx context.Context, host *HostBridgeClient, payload json.RawMessage) (any, error)

// HostBridgeClient lets a running sidecar handler call back into the native
// host over the shared stdio transport.
type HostBridgeClient struct {
	sidecar *Sidecar
}

// Call requests one typed host method and returns the raw JSON result payload.
// Handlers can unmarshal into whatever concrete shape they own.
func (h *HostBridgeClient) Call(methodID string, payload any) (json.RawMessage, error) {
	return h.sidecar.callHost(methodID, payload)
}

// Sidecar is the top-level state for an authored GreebleFS Go sidecar.
type Sidecar struct {
	actions            map[string]ActionHandler
	stdin              *bufio.Reader
	stdout             io.Writer
	stderr             io.Writer
	hostRequestCounter uint64
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
		stdin:   bufio.NewReaderSize(stdin, 1024*1024),
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
	for {
		request, err := s.readRequest()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("sidecar stdin read failed: %w", err)
		}
		if request.RequestID == "" {
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
		result, err := handler(context.Background(), &HostBridgeClient{sidecar: s}, payload)
		if err != nil {
			s.writeError(request.RequestID, err.Error())
			continue
		}
		s.writeResult(request.RequestID, result)
	}
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

func (s *Sidecar) emit(packet any) {
	encoded, err := json.Marshal(packet)
	if err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to encode response: %v\n", err)
		return
	}
	encoded = append(encoded, '\n')
	if _, err := s.stdout.Write(encoded); err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to write response: %v\n", err)
	}
}

func (s *Sidecar) readRequest() (ipc.Request, error) {
	var request ipc.Request
	line, err := s.readLine()
	if err != nil {
		return request, err
	}
	if line == "" {
		return request, nil
	}
	if err := json.Unmarshal([]byte(line), &request); err != nil {
		s.writeError("decode-error", fmt.Sprintf("failed to decode request: %v", err))
		return ipc.Request{}, nil
	}
	return request, nil
}

func (s *Sidecar) callHost(methodID string, payload any) (json.RawMessage, error) {
	trimmedMethodID := strings.TrimSpace(methodID)
	if trimmedMethodID == "" {
		return nil, fmt.Errorf("host bridge method id is required")
	}

	s.hostRequestCounter += 1
	requestID := fmt.Sprintf("host-%d", s.hostRequestCounter)
	payloadJSON, err := encodeOptionalPayload(payload)
	if err != nil {
		return nil, err
	}
	request := ipc.Request{
		RequestID:   requestID,
		Kind:        ipc.KindHostCall,
		MethodID:    &trimmedMethodID,
		PayloadJSON: payloadJSON,
	}
	s.emit(request)

	response, err := s.readHostResponse(requestID)
	if err != nil {
		return nil, err
	}
	if !response.OK {
		if response.Error != nil && *response.Error != "" {
			return nil, fmt.Errorf("%s", *response.Error)
		}
		return nil, fmt.Errorf("host bridge call failed with no message")
	}
	if response.ResultJSON == nil {
		return json.RawMessage("null"), nil
	}
	return json.RawMessage(*response.ResultJSON), nil
}

func (s *Sidecar) readHostResponse(expectedRequestID string) (ipc.Response, error) {
	var response ipc.Response
	line, err := s.readLine()
	if err != nil {
		return response, err
	}
	if err := json.Unmarshal([]byte(line), &response); err != nil {
		return response, fmt.Errorf("failed to decode host response: %w", err)
	}
	if response.Kind != ipc.KindHostResponse {
		return response, fmt.Errorf(
			"unexpected host bridge packet kind %q while waiting for %q",
			response.Kind,
			ipc.KindHostResponse,
		)
	}
	if response.RequestID != expectedRequestID {
		return response, fmt.Errorf(
			"host bridge response id mismatch: expected %s, got %s",
			expectedRequestID,
			response.RequestID,
		)
	}
	return response, nil
}

func (s *Sidecar) readLine() (string, error) {
	line, err := s.stdin.ReadString('\n')
	if err != nil && !(err == io.EOF && len(line) > 0) {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func encodeOptionalPayload(payload any) (*string, error) {
	if payload == nil {
		return nil, nil
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode host payload: %w", err)
	}
	payloadJSON := string(encoded)
	return &payloadJSON, nil
}
