package hostapi

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestMarshalTypedHostBridgeValueForJavaScript(t *testing.T) {
	type typedHostSubscriptionRequest struct {
		Topics          []string `json:"topics"`
		IncludeSnapshot bool     `json:"includeSnapshot"`
		ReplayFrom      *uint64  `json:"replayFrom,omitempty"`
	}

	replayFrom := uint64(7)
	raw, err := marshalTypedHostBridgeValueForJavaScript(typedHostSubscriptionRequest{
		Topics: []string{
			"selection.changed",
			"preview.session.changed",
			"cwd.changed",
		},
		IncludeSnapshot: true,
		ReplayFrom:      &replayFrom,
	})
	if err != nil {
		t.Fatalf("marshalTypedHostBridgeValueForJavaScript returned error: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		t.Fatalf("marshaled value is not valid JSON: %v", err)
	}

	if got, want := decoded["topics"], []any{
		"selection.changed",
		"preview.session.changed",
		"cwd.changed",
	}; !reflect.DeepEqual(got, want) {
		t.Fatalf("topics = %#v, want %#v", got, want)
	}
	if decoded["includeSnapshot"] != true {
		t.Fatalf("includeSnapshot = %#v, want true", decoded["includeSnapshot"])
	}
	if decoded["replayFrom"] != float64(7) {
		t.Fatalf("replayFrom = %#v, want 7", decoded["replayFrom"])
	}
}
