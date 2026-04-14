from pathlib import Path

app = Path(r'F:\apps-2d\overlayterm\src\App.tsx')
text = app.read_text(encoding='utf-8')
old = """    // Small delay so the terminal tab renders before we inject the cd
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('overlayterm:cdinject', { detail: path }));
    }, 80);
"""
new = """    // Small delay so the terminal tab renders before we inject the cd
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('overlayterm:cdinject', {
        detail: {
          path,
          shell: settings.shell,
        },
      }));
    }, 80);
"""
if old not in text:
    raise SystemExit('App.tsx block not found')
app.write_text(text.replace(old, new), encoding='utf-8')

term = Path(r'F:\apps-2d\overlayterm\src\components\TerminalOverlay.tsx')
text = term.read_text(encoding='utf-8')
text = text.replace("import { useTerminalStore, type Bookmark } from '../store/terminalStore';\n", "import { useTerminalStore, type Bookmark } from '../store/terminalStore';\nimport { buildTerminalCdCommand } from './terminalCommandUtils';\n")
old = """  const injectCd = useCallback(async (path: string) => injectCmd(`cd '${path}'`, true), [injectCmd]);
"""
new = """  const injectCd = useCallback(async (path: string, shell?: string) => {
    const command = buildTerminalCdCommand(path, shell ?? settings.shell);
    if (!command) {
      return;
    }
    await injectCmd(command, true);
  }, [injectCmd, settings.shell]);
"""
if old not in text:
    raise SystemExit('injectCd block not found')
text = text.replace(old, new)
old = """  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (path) void injectCd(path);
    };
"""
new = """  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string; shell?: string }>).detail;
      if (detail?.path) void injectCd(detail.path, detail.shell);
    };
"""
if old not in text:
    raise SystemExit('cdinject handler block not found')
text = text.replace(old, new)
term.write_text(text, encoding='utf-8')

# add test for app event payload? update terminalCommandUtils test with a direct shell example already exists
print('patched handoff')
