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
	"sync"

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
	actions                     map[string]ActionHandler
	stdin                       *bufio.Reader
	stdout                      io.Writer
	stderr                      io.Writer
	writeMu                     sync.Mutex
	requestCounter              uint64
	requestCounterMu            sync.Mutex
	pendingResponses            map[string]chan ipc.Packet
	pendingResponsesMu          sync.Mutex
	pendingSubscriptionHandlers map[string]HostEventHandler
	pendingSubscriptionMu       sync.Mutex
	subscriptionHandlers        map[string]HostEventHandler
	subscriptionHandlersMu      sync.RWMutex
}

// NewSidecar wires a sidecar against process stdio. Tests should use
// NewSidecarWithStreams.
func NewSidecar() *Sidecar {
	return NewSidecarWithStreams(os.Stdin, os.Stdout, os.Stderr)
}

// NewSidecarWithStreams allows redirecting the wire I/O for testing.
func NewSidecarWithStreams(stdin io.Reader, stdout io.Writer, stderr io.Writer) *Sidecar {
	return &Sidecar{
		actions:                     make(map[string]ActionHandler),
		stdin:                       bufio.NewReaderSize(stdin, 1024*1024),
		stdout:                      stdout,
		stderr:                      stderr,
		pendingResponses:            make(map[string]chan ipc.Packet),
		pendingSubscriptionHandlers: make(map[string]HostEventHandler),
		subscriptionHandlers:        make(map[string]HostEventHandler),
	}
}

// RegisterAction adds (or replaces) a typed action handler.
func (s *Sidecar) RegisterAction(actionID string, handler ActionHandler) {
	s.actions[actionID] = handler
}

// Serve consumes JSON-line packets until the stream ends or the host sends a
// shutdown packet. Action calls, host events, and nested host replies all flow
// through the same reader loop.
func (s *Sidecar) Serve() error {
	for {
		packet, err := s.readPacket()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("sidecar stdin read failed: %w", err)
		}
		if packet.RequestID == "" && packet.Kind == "" {
			continue
		}

		switch packet.Kind {
		case ipc.KindShutdown:
			return nil
		case ipc.KindCall, "":
			if packet.ActionID == nil {
				s.writeError(packet.RequestID, fmt.Sprintf("unsupported request kind: %s", packet.Kind))
				continue
			}
			actionID := *packet.ActionID
			handler, ok := s.actions[actionID]
			if !ok {
				s.writeError(packet.RequestID, fmt.Sprintf("unknown action: %s", actionID))
				continue
			}
			go s.handleAction(packet, handler)
		case ipc.KindEvent, ipc.KindSnapshot:
			s.dispatchHostEvent(packet)
		case ipc.KindAck, ipc.KindHostResponse, ipc.KindResponse, ipc.KindReady, ipc.KindError:
			s.resolvePendingResponse(packet)
		default:
			if packet.ActionID != nil {
				go s.handleAction(packet, s.actions[*packet.ActionID])
				continue
			}
			s.resolvePendingResponse(packet)
		}
	}
}

func (s *Sidecar) handleAction(request ipc.Packet, handler ActionHandler) {
	var payload json.RawMessage
	if request.PayloadJSON != nil && *request.PayloadJSON != "" {
		payload = json.RawMessage(*request.PayloadJSON)
	}
	result, err := handler(context.Background(), &HostBridgeClient{sidecar: s}, payload)
	if err != nil {
		s.writeError(request.RequestID, err.Error())
		return
	}
	s.writeResult(request.RequestID, result)
}

func (s *Sidecar) writeResult(requestID string, value any) {
	encoded, err := json.Marshal(value)
	if err != nil {
		s.writeError(requestID, fmt.Sprintf("failed to encode action result: %v", err))
		return
	}
	resultStr := string(encoded)
	ok := true
	response := ipc.Packet{
		RequestID:  requestID,
		Kind:       ipc.KindResponse,
		OK:         &ok,
		ResultJSON: &resultStr,
	}
	s.emit(response)
}

func (s *Sidecar) writeError(requestID string, message string) {
	msg := message
	ok := false
	response := ipc.Packet{
		RequestID: requestID,
		Kind:      ipc.KindResponse,
		OK:        &ok,
		Error:     &msg,
	}
	s.emit(response)
}

func (s *Sidecar) emit(packet any) {
	encoded, err := json.Marshal(packet)
	if err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to encode response: %v\n", err)
		return
	}
	encoded = append(encoded, '\n')
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if _, err := s.stdout.Write(encoded); err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to write response: %v\n", err)
	}
}

func (s *Sidecar) readPacket() (ipc.Packet, error) {
	var packet ipc.Packet
	line, err := s.readLine()
	if err != nil {
		return packet, err
	}
	if line == "" {
		return packet, nil
	}
	if err := json.Unmarshal([]byte(line), &packet); err != nil {
		s.writeError("decode-error", fmt.Sprintf("failed to decode request: %v", err))
		return ipc.Packet{}, nil
	}
	return packet, nil
}

func (s *Sidecar) callHost(methodID string, payload any) (json.RawMessage, error) {
	trimmedMethodID := strings.TrimSpace(methodID)
	if trimmedMethodID == "" {
		return nil, fmt.Errorf("host bridge method id is required")
	}

	payloadJSON, err := encodeOptionalPayload(payload)
	if err != nil {
		return nil, err
	}
	response, err := s.sendPacketAndAwaitResponse(ipc.Packet{
		RequestID:   s.nextRequestID("host"),
		Kind:        ipc.KindHostCall,
		MethodID:    &trimmedMethodID,
		PayloadJSON: payloadJSON,
	})
	if err != nil {
		return nil, err
	}
	if response.OK != nil && !*response.OK {
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

func (s *Sidecar) subscribeHostEvents(
	request HostSubscriptionRequest,
	handler HostEventHandler,
) (HostSubscription, error) {
	requestID := s.nextRequestID("subscribe")
	if handler != nil {
		s.pendingSubscriptionMu.Lock()
		s.pendingSubscriptionHandlers[requestID] = handler
		s.pendingSubscriptionMu.Unlock()
	}
	response, err := s.sendJSONPacketAndAwaitResponse(requestID, ipc.KindSubscribe, request)
	if err != nil {
		s.clearPendingSubscriptionHandler(requestID)
		return HostSubscription{}, err
	}
	if response.OK != nil && !*response.OK {
		s.clearPendingSubscriptionHandler(requestID)
		if response.Error != nil {
			return HostSubscription{}, fmt.Errorf("%s", *response.Error)
		}
		return HostSubscription{}, fmt.Errorf("events.subscribe failed with no message")
	}
	var subscription HostSubscription
	if response.ResultJSON != nil && *response.ResultJSON != "" {
		if err := json.Unmarshal([]byte(*response.ResultJSON), &subscription); err != nil {
			return HostSubscription{}, fmt.Errorf("failed to decode events.subscribe result: %w", err)
		}
	}
	return subscription, nil
}

func (s *Sidecar) unsubscribeHostEvents(subscriptionID string) (*HostSubscription, error) {
	trimmedSubscriptionID := strings.TrimSpace(subscriptionID)
	if trimmedSubscriptionID == "" {
		return nil, fmt.Errorf("events.unsubscribe requires a subscription id")
	}
	s.subscriptionHandlersMu.Lock()
	delete(s.subscriptionHandlers, trimmedSubscriptionID)
	s.subscriptionHandlersMu.Unlock()
	response, err := s.sendPacketAndAwaitResponse(ipc.Packet{
		RequestID:      s.nextRequestID("unsubscribe"),
		Kind:           ipc.KindUnsubscribe,
		SubscriptionID: &trimmedSubscriptionID,
	})
	if err != nil {
		return nil, err
	}
	if response.OK != nil && !*response.OK {
		if response.Error != nil {
			return nil, fmt.Errorf("%s", *response.Error)
		}
		return nil, fmt.Errorf("events.unsubscribe failed with no message")
	}
	if response.ResultJSON == nil || *response.ResultJSON == "" || *response.ResultJSON == "null" {
		return nil, nil
	}
	var subscription HostSubscription
	if err := json.Unmarshal([]byte(*response.ResultJSON), &subscription); err != nil {
		return nil, fmt.Errorf("failed to decode events.unsubscribe result: %w", err)
	}
	return &subscription, nil
}

func (s *Sidecar) publishHostEvent(request HostPublishEventRequest) (HostEventEnvelope, error) {
	response, err := s.sendJSONPacketAndAwaitResponse(
		s.nextRequestID("publish"),
		ipc.KindPublish,
		request,
	)
	if err != nil {
		return HostEventEnvelope{}, err
	}
	if response.OK != nil && !*response.OK {
		if response.Error != nil {
			return HostEventEnvelope{}, fmt.Errorf("%s", *response.Error)
		}
		return HostEventEnvelope{}, fmt.Errorf("events.publish failed with no message")
	}
	var envelope HostEventEnvelope
	if response.ResultJSON != nil && *response.ResultJSON != "" {
		if err := json.Unmarshal([]byte(*response.ResultJSON), &envelope); err != nil {
			return HostEventEnvelope{}, fmt.Errorf("failed to decode events.publish result: %w", err)
		}
	}
	return envelope, nil
}

func (s *Sidecar) sendJSONPacketAndAwaitResponse(
	requestID string,
	kind string,
	payload any,
) (ipc.Packet, error) {
	payloadJSON, err := encodeOptionalPayload(payload)
	if err != nil {
		return ipc.Packet{}, err
	}
	return s.sendPacketAndAwaitResponse(ipc.Packet{
		RequestID:   requestID,
		Kind:        kind,
		PayloadJSON: payloadJSON,
	})
}

func (s *Sidecar) sendPacketAndAwaitResponse(packet ipc.Packet) (ipc.Packet, error) {
	responseCh := make(chan ipc.Packet, 1)
	s.pendingResponsesMu.Lock()
	s.pendingResponses[packet.RequestID] = responseCh
	s.pendingResponsesMu.Unlock()
	s.emit(packet)
	response, ok := <-responseCh
	if !ok {
		return ipc.Packet{}, fmt.Errorf("sidecar request %s closed before a response arrived", packet.RequestID)
	}
	return response, nil
}

func (s *Sidecar) resolvePendingResponse(packet ipc.Packet) {
	if packet.Kind == ipc.KindAck {
		s.maybeInstallSubscriptionHandler(packet)
	}
	s.pendingResponsesMu.Lock()
	responseCh, ok := s.pendingResponses[packet.RequestID]
	if ok {
		delete(s.pendingResponses, packet.RequestID)
	}
	s.pendingResponsesMu.Unlock()
	if ok {
		responseCh <- packet
		close(responseCh)
	}
}

func (s *Sidecar) maybeInstallSubscriptionHandler(packet ipc.Packet) {
	s.pendingSubscriptionMu.Lock()
	handler, ok := s.pendingSubscriptionHandlers[packet.RequestID]
	if ok {
		delete(s.pendingSubscriptionHandlers, packet.RequestID)
	}
	s.pendingSubscriptionMu.Unlock()
	if !ok || handler == nil {
		return
	}
	if packet.OK != nil && !*packet.OK {
		return
	}
	if packet.ResultJSON == nil || *packet.ResultJSON == "" {
		return
	}
	var subscription HostSubscription
	if err := json.Unmarshal([]byte(*packet.ResultJSON), &subscription); err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to decode subscription ack: %v\n", err)
		return
	}
	s.subscriptionHandlersMu.Lock()
	s.subscriptionHandlers[subscription.SubscriptionID] = handler
	s.subscriptionHandlersMu.Unlock()
}

func (s *Sidecar) clearPendingSubscriptionHandler(requestID string) {
	s.pendingSubscriptionMu.Lock()
	delete(s.pendingSubscriptionHandlers, requestID)
	s.pendingSubscriptionMu.Unlock()
}

func (s *Sidecar) dispatchHostEvent(packet ipc.Packet) {
	if packet.PayloadJSON == nil || *packet.PayloadJSON == "" {
		return
	}
	var event HostEventEnvelope
	if err := json.Unmarshal([]byte(*packet.PayloadJSON), &event); err != nil {
		fmt.Fprintf(s.stderr, "[greeblefs-sdk] failed to decode host event: %v\n", err)
		return
	}
	subscriptionID := ""
	if packet.SubscriptionID != nil {
		subscriptionID = *packet.SubscriptionID
	} else if event.SubscriptionID != nil {
		subscriptionID = *event.SubscriptionID
	}
	if subscriptionID == "" {
		return
	}
	s.subscriptionHandlersMu.RLock()
	handler := s.subscriptionHandlers[subscriptionID]
	s.subscriptionHandlersMu.RUnlock()
	if handler == nil {
		return
	}
	go handler(event)
}

func (s *Sidecar) nextRequestID(prefix string) string {
	s.requestCounterMu.Lock()
	defer s.requestCounterMu.Unlock()
	s.requestCounter++
	return fmt.Sprintf("%s-%d", prefix, s.requestCounter)
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
