import type {
  ExplorerExecutableScriptRunner,
} from "../../config/filePreview";
import {
  getExecutableScriptRunner,
  getMonacoLanguage,
  isExecutableBinaryExtension,
  isExecutableScriptExtension,
} from "../../config/filePreview";
import type {
  ExplorerFileEntry,
  ExplorerItemProperties,
} from "../../runtime/explorerBackend";
import type { RuntimePlatform } from "../../config/platform";

const MAX_EXECUTABLE_TEXT_SCRIPT_BYTES = 2 * 1024 * 1024;

const SHEBANG_LANGUAGE_BY_INTERPRETER: Record<string, string> = {
  bash: "shell",
  bun: "javascript",
  deno: "typescript",
  fish: "shell",
  ksh: "shell",
  node: "javascript",
  perl: "perl",
  php: "php",
  pwsh: "powershell",
  python: "python",
  python3: "python",
  ruby: "ruby",
  sh: "shell",
  zsh: "shell",
};

export interface ExplorerResolvedScriptPreview {
  language: string;
  runner: ExplorerExecutableScriptRunner;
  content: string;
}

export type ExplorerExecutableTextScriptProbeResult =
  | { kind: "script"; preview: ExplorerResolvedScriptPreview }
  | { kind: "binary" }
  | { kind: "none" };

export function resolveExecutableScriptPreviewFromExtension(
  entry: Pick<ExplorerFileEntry, "extension">,
): ExplorerResolvedScriptPreview | null {
  const runner = getExecutableScriptRunner(entry.extension);
  if (!runner) {
    return null;
  }

  return {
    language: getMonacoLanguage(entry.extension),
    runner,
    content: "",
  };
}

export async function probeExecutableTextScriptPreview(args: {
  entry: Pick<ExplorerFileEntry, "path" | "extension" | "size" | "is_dir">;
  runtimePlatform: RuntimePlatform;
  getItemProperties: (path: string) => Promise<ExplorerItemProperties>;
  readTextFile: (path: string) => Promise<string>;
}): Promise<ExplorerExecutableTextScriptProbeResult> {
  const { entry, runtimePlatform, getItemProperties, readTextFile } = args;

  if (
    entry.is_dir ||
    runtimePlatform === "windows" ||
    entry.size > MAX_EXECUTABLE_TEXT_SCRIPT_BYTES ||
    isExecutableScriptExtension(entry.extension) ||
    isExecutableBinaryExtension(entry.extension)
  ) {
    return { kind: "none" };
  }

  const properties = await getItemProperties(entry.path).catch(() => null);
  if (!properties || !hasUnixExecutePermission(properties)) {
    return { kind: "none" };
  }

  try {
    const content = await readTextFile(entry.path);
    return {
      kind: "script",
      preview: {
        language: resolveExecutableScriptLanguage(entry.extension, content),
        runner: "direct",
        content,
      },
    };
  } catch {
    return { kind: "binary" };
  }
}

function hasUnixExecutePermission(
  properties: Pick<ExplorerItemProperties, "permissions">,
): boolean {
  return ((properties.permissions.unixMode ?? 0) & 0o111) !== 0;
}

function resolveExecutableScriptLanguage(
  extension: string,
  content: string,
): string {
  const extensionLanguage = getMonacoLanguage(extension);
  if (extensionLanguage !== "plaintext") {
    return extensionLanguage;
  }

  const shebangInterpreter = parseShebangInterpreter(content);
  if (!shebangInterpreter) {
    return extensionLanguage;
  }

  return SHEBANG_LANGUAGE_BY_INTERPRETER[shebangInterpreter] ?? extensionLanguage;
}

function parseShebangInterpreter(content: string): string | null {
  const [firstLine = ""] = content.split(/\r?\n/, 1);
  const normalizedLine = firstLine.trim();
  if (!normalizedLine.startsWith("#!")) {
    return null;
  }

  const shebangCommand = normalizedLine.slice(2).trim();
  if (!shebangCommand) {
    return null;
  }

  const segments = shebangCommand.split(/\s+/).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const interpreterToken =
    segments[0]?.endsWith("/env") && segments.length > 1
      ? segments[1]
      : segments[0];
  if (!interpreterToken) {
    return null;
  }

  return interpreterToken
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
    ?.toLowerCase() ?? null;
}
