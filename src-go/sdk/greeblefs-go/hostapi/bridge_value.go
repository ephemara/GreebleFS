package hostapi

import "encoding/json"

func marshalTypedHostBridgeValueForJavaScript(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
