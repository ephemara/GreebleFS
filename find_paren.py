with open('src/components/ExplorerAudioWorkbench.tsx') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.count('(') != line.count(')'):
        print(f"Line {i+1}: {line.strip()} (Opens: {line.count('(')}, Closes: {line.count(')')})")
