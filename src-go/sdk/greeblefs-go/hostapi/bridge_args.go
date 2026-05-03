package hostapi

import "strings"

const bridgeTokenArgumentName = "--bridge-token"

func parseBridgeTokenFromArgs(args []string) string {
	for index := 0; index < len(args); index++ {
		arg := args[index]
		if arg == bridgeTokenArgumentName {
			if index+1 >= len(args) {
				return ""
			}
			return strings.TrimSpace(args[index+1])
		}
		if strings.HasPrefix(arg, bridgeTokenArgumentName+"=") {
			return strings.TrimSpace(strings.TrimPrefix(arg, bridgeTokenArgumentName+"="))
		}
	}
	return ""
}
