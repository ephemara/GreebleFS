// Package ipc holds the wire types for the GreebleFS sidecar JSON-lines
// protocol shared between Go runtimes and the host's ExternalSidecarManager.
package ipc

// Request is a single inbound packet from the host.
type Request struct {
	RequestID   string             `json:"requestId"`
	Kind        string             `json:"kind"`
	ActionID    *string            `json:"actionId,omitempty"`
	MethodID    *string            `json:"methodId,omitempty"`
	PayloadJSON *string            `json:"payloadJson,omitempty"`
	CWD         *string            `json:"cwd,omitempty"`
	Environment *map[string]string `json:"environment,omitempty"`
}

// Response is a single outbound packet to the host.
type Response struct {
	RequestID  string  `json:"requestId"`
	Kind       string  `json:"kind,omitempty"`
	OK         bool    `json:"ok"`
	ResultJSON *string `json:"resultJson,omitempty"`
	Error      *string `json:"error,omitempty"`
}

// KindCall identifies a typed action invocation.
const KindCall = "call"

// KindShutdown is sent by the host when the sidecar should terminate.
const KindShutdown = "shutdown"

// KindHostCall is sent by a sidecar when it needs the native host to perform
// one typed action on its behalf.
const KindHostCall = "host-call"

// KindHostResponse is sent by the host after it finishes one host call that
// originated inside a sidecar action handler.
const KindHostResponse = "host-response"
