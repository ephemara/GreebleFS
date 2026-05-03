package hostapi

import "testing"

func TestParseBridgeTokenFromArgs(t *testing.T) {
	tests := []struct {
		name string
		args []string
		want string
	}{
		{
			name: "equals form",
			args: []string{"--bridge-token=runtime::123", "--runtime-id=go-pty-panel"},
			want: "runtime::123",
		},
		{
			name: "space separated form",
			args: []string{"--runtime-id=go-pty-panel", "--bridge-token", "runtime::456"},
			want: "runtime::456",
		},
		{
			name: "missing value",
			args: []string{"--bridge-token"},
			want: "",
		},
		{
			name: "absent",
			args: []string{"--runtime-id=go-pty-panel"},
			want: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := parseBridgeTokenFromArgs(test.args)
			if got != test.want {
				t.Fatalf("parseBridgeTokenFromArgs(%v) = %q, want %q", test.args, got, test.want)
			}
		})
	}
}
