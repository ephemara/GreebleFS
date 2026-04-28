// Package ipc holds the wire types for the GreebleFS sidecar JSON-lines
// protocol shared between Go runtimes and the host's ExternalSidecarManager.
package ipc

// Packet is one JSON-lines frame flowing between the host and a sidecar.
//
// v1 uses `call`, `shutdown`, `host-call`, and `host-response`.
// v2 adds `response`, `subscribe`, `unsubscribe`, `publish`, `event`,
// `snapshot`, `ack`, `ready`, and `error`.
type Packet struct {
	RequestID      string             `json:"requestId"`
	Kind           string             `json:"kind,omitempty"`
	ActionID       *string            `json:"actionId,omitempty"`
	MethodID       *string            `json:"methodId,omitempty"`
	PayloadJSON    *string            `json:"payloadJson,omitempty"`
	CWD            *string            `json:"cwd,omitempty"`
	Environment    *map[string]string `json:"environment,omitempty"`
	OK             *bool              `json:"ok,omitempty"`
	ResultJSON     *string            `json:"resultJson,omitempty"`
	Error          *string            `json:"error,omitempty"`
	SubscriptionID *string            `json:"subscriptionId,omitempty"`
}

// Request and Response are kept as aliases so existing sidecar authors do not
// have to rewrite every local variable when moving onto the v2 transport.
type Request = Packet
type Response = Packet

const (
	// KindCall identifies a typed action invocation.
	KindCall = "call"
	// KindResponse identifies a normal action response packet in v2. Legacy
	// runtimes may still omit it.
	KindResponse = "response"
	// KindShutdown is sent by the host when the sidecar should terminate.
	KindShutdown = "shutdown"
	// KindHostCall is sent by a sidecar when it needs the native host to
	// perform one typed action on its behalf.
	KindHostCall = "host-call"
	// KindHostResponse is sent by the host after it finishes one host call that
	// originated inside a sidecar handler.
	KindHostResponse = "host-response"
	// KindSubscribe registers one long-lived host event subscription.
	KindSubscribe = "subscribe"
	// KindUnsubscribe cancels one host event subscription.
	KindUnsubscribe = "unsubscribe"
	// KindPublish emits one custom `ext.<extensionId>.*` host event.
	KindPublish = "publish"
	// KindEvent delivers one live host event to the sidecar.
	KindEvent = "event"
	// KindSnapshot delivers one snapshot/replay event to the sidecar.
	KindSnapshot = "snapshot"
	// KindAck acknowledges a sidecar-originated control packet such as
	// subscribe/unsubscribe/publish.
	KindAck = "ack"
	// KindReady lets a runtime announce boot readiness.
	KindReady = "ready"
	// KindError reports a runtime-level transport failure.
	KindError = "error"
)
