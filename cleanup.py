import re
with open('src/components/ExplorerAudioWorkbench.tsx', 'r') as f:
    text = f.read()

# remove unused imports from lucide-react
text = re.sub(r'\s*AlertTriangle,', '', text)
text = re.sub(r'\s*RotateCcw,', '', text)
text = re.sub(r'\s*Save,', '', text)
text = re.sub(r'\s*Scissors,', '', text)
text = re.sub(r'\s*Sparkles,', '', text)
text = re.sub(r'\s*Waves,', '', text)

# remove AudioWorkbenchSummaryItem
text = re.sub(r'type AudioWorkbenchSummaryItem = {[^}]+};\n\n', '', text)

# remove SILENCE_REGION_PREVIEW_LIMIT
text = re.sub(r'const SILENCE_REGION_PREVIEW_LIMIT = 6;\n', '', text)

# exportState
text = text.replace("const [exportState, setExportState] = useState<ExportState>('idle');\n", "")
text = text.replace("setExportState('idle');\n", "")
text = text.replace("setExportState('running');\n", "")
text = text.replace("setExportState('saved');\n", "")
text = text.replace("setExportState('error');\n", "")
text = text.replace("type ExportState = 'idle' | 'running' | 'saved' | 'error';\n", "")

# selectSilenceRegion
text = re.sub(r'  function selectSilenceRegion\(startSeconds: number, endSeconds: number\) \{[\s\S]*?\}\n\n', '', text)

# engineStatusBadges
text = re.sub(r'  const engineStatusBadges = \[[\s\S]*?\]\.filter\(Boolean\) as string\[\];\n\n', '', text)

with open('src/components/ExplorerAudioWorkbench.tsx', 'w') as f:
    f.write(text)
