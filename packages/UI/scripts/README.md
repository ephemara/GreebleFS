# UI Forge Scripts

This directory contains example scripts and showcases for the UI Forge system.

## 📁 What's Here

All showcase, example, and test scripts for generating UI assets. These are NOT part of the core library - they're examples showing how to use UI Forge.

## 🚀 Running Scripts

```bash
cd sources/python/UI
python scripts/ANIMATED_ICONS_20.py
python scripts/generate_showcase.py
# etc.
```

## 📝 Available Scripts

### Animated Icons
- `ANIMATED_ICONS_20.py` - Generate 20 animated icons with motion effects
- `ANIMATION_DIRECT.py` - Direct animation generation
- `ANIMATION_SHOWCASE.py` - Animation showcase gallery

### Static Icons
- `generate_showcase.py` - Generate DIY and Insane style icons
- `NO_VALIDATION_SHOWCASE.py` - Showcase without validation
- `FINAL_SHOWCASE.py` - Final showcase gallery
- `quick_showcase.py` - Quick icon generation
- `showcase_now.py` - Instant showcase generation

### GreebleFS Icon Theme Coverage
- `generate_greeblefs_zen_ui_icons.py` - Expands the current `src/components/AppIcons.tsx` slot list into the repo-local `icon-themes/Zen/ui/` coverage pack and updates `icon-themes/Zen/icon-theme.json` to match.
- This is the reference generator for app chrome. If you add a new app-wide icon slot, rerun this script so the Zen example shows the SVG a theme author is expected to provide.
- The current Zen contract is intentionally one-to-one: app slots should map to same-name SVG ids instead of aliasing back to older generic assets.

## 💡 Creating Your Own Scripts

Use these as templates! Copy any script and modify it for your needs.

Basic pattern:
```python
from core import UIForgeEngine
from models import Template, GeneratorType, OutputFormat

# Create engine (validation off by default)
engine = UIForgeEngine()

# Create template
template = Template(
    name="my-icon",
    generator_type=GeneratorType.ICON,
    # ... your config
)

# Generate
result = engine.generate_asset(template)
```

## 📂 Output Location

All generated assets go to `../output/` by default.
HTML galleries are also saved there.
