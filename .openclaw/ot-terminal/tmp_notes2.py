from pathlib import Path

notes = [
    (Path(r'F:\apps-2d\overlayterm\.openclaw\ot-terminal\MEMORY.md'), "\n\n## Terminal handoff note\n\n- Explorer-to-terminal injection now reuses `buildTerminalCdCommand`, so the active shell gets a shell-aware `cd`/`Set-Location` command instead of a raw quoted path.\n"),
    (Path(r'F:\apps-2d\overlayterm\SHIPPLAN.md'), "\n### 2026-04-14 terminal handoff\n- Explorer-to-terminal handoff now routes through the shared shell-aware cd builder, which should keep PowerShell, cmd, and POSIX-safe path handling aligned.\n- Validation attempt: `bunx vitest run src/test/terminalCommandUtils.test.ts` was blocked by local missing toolchain packages (`vitest`, `@vitejs/plugin-react`).\n"),
    (Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\validation.md'), "\n- 2026-04-14, terminal handoff pass: explorer-to-terminal now uses the shared shell-aware cd command builder instead of hardcoded `cd '<path>'`.\n- Validation attempt: `bunx vitest run src/test/terminalCommandUtils.test.ts` could not start because the local environment is missing `vitest` and `@vitejs/plugin-react`.\n")
]
for path, addition in notes:
    text = path.read_text(encoding='utf-8')
    if addition.strip() not in text:
        path.write_text(text.rstrip() + addition, encoding='utf-8')
        print('updated', path)
    else:
        print('already had', path)
