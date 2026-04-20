import { describe, expect, it, vi } from "vitest";
import {
  probeExecutableTextScriptPreview,
  resolveExecutableScriptPreviewFromExtension,
} from "../components/explorer/explorerScriptRuntime";

describe("explorerScriptRuntime", () => {
  it("maps known executable script extensions into inline script previews", () => {
    expect(
      resolveExecutableScriptPreviewFromExtension({ extension: "bat" }),
    ).toEqual({
      language: "bat",
      runner: "batch",
      content: "",
    });
    expect(
      resolveExecutableScriptPreviewFromExtension({ extension: "ps1" }),
    ).toEqual({
      language: "powershell",
      runner: "powershell",
      content: "",
    });
    expect(
      resolveExecutableScriptPreviewFromExtension({ extension: "txt" }),
    ).toBeNull();
  });

  it("upgrades unix executable text files into direct-run script previews", async () => {
    const getItemProperties = vi.fn().mockResolvedValue({
      permissions: {
        readonly: false,
        display: "rwxr-xr-x (755)",
        unixMode: 0o755,
        unixModeOctal: "755",
      },
    });
    const readTextFile = vi
      .fn()
      .mockResolvedValue("#!/usr/bin/env python3\nprint('hi')\n");

    await expect(
      probeExecutableTextScriptPreview({
        entry: {
          path: "/workspace/tools/release-tool",
          extension: "",
          size: 128,
          is_dir: false,
        },
        runtimePlatform: "linux",
        getItemProperties,
        readTextFile,
      }),
    ).resolves.toEqual({
      kind: "script",
      preview: {
        language: "python",
        runner: "direct",
        content: "#!/usr/bin/env python3\nprint('hi')\n",
      },
    });
  });

  it("leaves non-executable text files on unix in the generic text path", async () => {
    const getItemProperties = vi.fn().mockResolvedValue({
      permissions: {
        readonly: false,
        display: "rw-r--r-- (644)",
        unixMode: 0o644,
        unixModeOctal: "644",
      },
    });
    const readTextFile = vi.fn();

    await expect(
      probeExecutableTextScriptPreview({
        entry: {
          path: "/workspace/tools/release-tool",
          extension: "py",
          size: 128,
          is_dir: false,
        },
        runtimePlatform: "linux",
        getItemProperties,
        readTextFile,
      }),
    ).resolves.toEqual({ kind: "none" });
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("marks unreadable executable files as binary previews instead of script editors", async () => {
    const getItemProperties = vi.fn().mockResolvedValue({
      permissions: {
        readonly: false,
        display: "rwxr-xr-x (755)",
        unixMode: 0o755,
        unixModeOctal: "755",
      },
    });
    const readTextFile = vi.fn().mockRejectedValue(new Error("stream did not contain valid UTF-8"));

    await expect(
      probeExecutableTextScriptPreview({
        entry: {
          path: "/workspace/tools/binary-tool",
          extension: "",
          size: 128,
          is_dir: false,
        },
        runtimePlatform: "macos",
        getItemProperties,
        readTextFile,
      }),
    ).resolves.toEqual({ kind: "binary" });
  });
});
