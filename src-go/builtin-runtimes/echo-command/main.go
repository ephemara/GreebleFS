// echo-command is a minimal native-command runtime used by tests and as a
// reference implementation. It prints each argument on its own line, then
// reads stdin to stdout to validate stdin piping through the host bridge.
package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
)

func main() {
	for _, arg := range os.Args[1:] {
		fmt.Println(arg)
	}
	reader := bufio.NewReader(os.Stdin)
	if _, err := io.Copy(os.Stdout, reader); err != nil {
		fmt.Fprintf(os.Stderr, "echo-command: failed to copy stdin: %v\n", err)
		os.Exit(1)
	}
}
