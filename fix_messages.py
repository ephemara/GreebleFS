import re

with open('src/components/ExplorerAudioWorkbench.tsx', 'r') as f:
    content = f.read()

# Replace export messages
content = content.replace(
    "'Rust owns transport. SoX stays in the offline export lane.'",
    "'Ready for playback and export.'"
)

# Replace workbench statuses
content = content.replace(
    "'Preparing native audio engine…'",
    "'Preparing audio environment…'"
)
content = content.replace(
    "'Loading the current explorer selection into the native audio engine…'",
    "'Loading the current selection…'"
)
content = content.replace(
    "'The selected file is loaded in the native engine. Playback is running through Rust, not the webview.'",
    "'Audio loaded and ready for playback.'"
)
content = content.replace(
    "'Playback running from the native engine.'",
    "'Playback started.'"
)

# Replace "Running SoX transform…"
content = content.replace(
    "'Running SoX transform…'",
    "'Processing audio export…'"
)

# Replace "Overwriting original audio with SoX…"
content = content.replace(
    "'Overwriting original audio with SoX…'",
    "'Overwriting original audio…'"
)

content = content.replace(
    "SoX will write a",
    "This will write a"
)

content = content.replace(
    "submitLabel='Run SoX Export'",
    "submitLabel='Export Audio'"
)


with open('src/components/ExplorerAudioWorkbench.tsx', 'w') as f:
    f.write(content)
