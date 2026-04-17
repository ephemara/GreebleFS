cp src/components/ExplorerAudioWorkbench.tsx backup.tsx
sed -i '600,780d' src/components/ExplorerAudioWorkbench.tsx
npx esbuild src/components/ExplorerAudioWorkbench.tsx > /dev/null
echo Exit: $?
mv backup.tsx src/components/ExplorerAudioWorkbench.tsx
