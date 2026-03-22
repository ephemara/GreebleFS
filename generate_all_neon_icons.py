import sys
import os
import hashlib
from pathlib import Path

# Add UI Forge to path
sys.path.insert(0, r"M:\PyMono\UIForge")
sys.path.insert(0, r"M:\PyMono")

try:
    from core import UIForgeEngine
    from llm_api import circle, icon, line, path, polygon, rect, solid, stroke
except ModuleNotFoundError:
    print("UIForge not found at M:\\PyMono\\UIForge!")
    sys.exit(1)

OUTPUT_DIR = Path(r"M:\OverlayTerm\output\vintage-terminal-svg")
os.makedirs(OUTPUT_DIR, exist_ok=True)

engine = UIForgeEngine(output_dir=OUTPUT_DIR)
FORMATS = ["svg"]

def neon_stroke(color, width=6):
    # miter_limit argument might be supported, but we just use basic kwargs to be safe.
    return stroke(color, width=width, cap="round", join="round")

def crt_fill():
    return solid("#111111")
    
# Neon palette
PALETTE = ["#FF00FF", "#00FFFF", "#39FF14", "#FFFF00", "#FF3300"]

def get_color(name, offset=0):
    idx = int(hashlib.md5(name.encode()).hexdigest(), 16)
    return PALETTE[(idx + offset) % len(PALETTE)]

def gen_folder(name, is_open):
    c1 = get_color(name, 0) if name != "folder" else "#FFFF00"
    c2 = get_color(name, 1) if name != "folder" else "#FF00FF"
    
    layers = []
    
    if is_open:
        layers.append(rect(16, 32, 96, 72, rx=4, fill=crt_fill(), stroke=neon_stroke(c1, 8)))
        layers.append(rect(28, 24, 72, 72, fill=crt_fill(), stroke=neon_stroke("#ffffff", 4)))
        layers.append(polygon([(8,64), (120,64), (112,112), (16,112)], fill=crt_fill(), stroke=neon_stroke(c2, 8)))
    else:
        layers.append(rect(16, 24, 40, 24, rx=4, fill=crt_fill(), stroke=neon_stroke(c1, 8)))
        layers.append(rect(16, 40, 96, 72, rx=8, fill=crt_fill(), stroke=neon_stroke(c1, 8)))
        layers.append(line(32, 64, 96, 64, stroke=neon_stroke(c2, 6)))
        
    full_name = f"folder_{name}_open" if is_open and name != "folder" else (f"folder_open" if is_open else (f"folder_{name}" if name != "folder" else "folder"))
    
    # We unpack layers as *args
    return icon(
        full_name,
        *layers,
        category="folders",
        formats=FORMATS,
        size=128
    )

def gen_doc(name, override_glyph=None):
    c1 = get_color(name, 0)
    c2 = get_color(name, 1)
    
    layers = [
        polygon([(24, 16), (72, 16), (104, 48), (104, 112), (24, 112)], fill=crt_fill(), stroke=neon_stroke(c1, 8)),
        polygon([(72, 16), (72, 48), (104, 48)], fill=crt_fill(), stroke=neon_stroke(c1, 8))
    ]
    
    if override_glyph:
        layers.extend(override_glyph)
    else:
        h = int(hashlib.md5(name.encode()).hexdigest(), 16)
        glyph_type = h % 4
        x, y = 44, 60
        
        if glyph_type == 0:
            layers.append(polygon([(128/2, y), (128/2+20, y+32), (128/2-20, y+32)], fill=solid(c2)))
        elif glyph_type == 1:
            layers.append(rect(128/2-16, y, 32, 32, stroke=neon_stroke(c2, 6)))
            layers.append(circle(128/2, y+16, 8, fill=solid(c1)))
        elif glyph_type == 2:
            layers.append(path(f"M 44 {y} L 84 {y} L 44 {y+32} L 84 {y+32}", stroke=neon_stroke(c2, 8)))
        else:
            layers.append(line(128/2-16, y, 128/2+16, y+32, stroke=neon_stroke(c2, 8)))
            layers.append(line(128/2+16, y, 128/2-16, y+32, stroke=neon_stroke(c1, 8)))
        
    return icon(
        name,
        *layers,
        category="files",
        formats=FORMATS,
        size=128
    )

folders = [
    "folder", "ai", "api", "assets", "build", "components", "config", "database",
    "docs", "engine", "packages", "plugins", "public", "scripts", "src", "test"
]

files = [
    "app", "archive", "audio", "c", "clojure", "cmake", "cpp", "csharp", "css", "dart", 
    "database", "deb", "dll", "dmg", "dockerfile", "editorconfig", "elixir", "env", "erlang", "exe",
    "font", "git", "gitignore", "glsl", "go", "gradle", "haskell", "hlsl", "html", "image", "ini", 
    "ink", "java", "javascript", "json", "kain", "kotlin", "less", "lock", "log", "lua", "makefile", 
    "markdown", "model3d", "npm", "ocaml", "pdf", "php", "powershell", "python", "r", "ruby", "rust", 
    "sass", "scala", "scss", "shell", "spv", "sql", "swift", "toml", "txt", "typescript", "uasset", 
    "uproject", "video", "wgsl", "xml", "yaml", "zentako-logo-128", "zig", "zip"
]

templates = []

for f in folders:
    templates.append(gen_folder(f, False))
    templates.append(gen_folder(f, True))
    
for f in files:
    if f == "video":
        t = gen_doc(f, override_glyph=[polygon([(52, 60), (84, 76), (52, 92)], stroke=neon_stroke("#00FFFF", 6), fill=crt_fill())])
    elif f == "audio":
        t = gen_doc(f, override_glyph=[path("M 48 92 L 48 60 M 64 92 L 64 48 M 80 92 L 80 60", stroke=neon_stroke("#FF00FF", 8))])
    elif f == "database":
        t = gen_doc(f, override_glyph=[path("M 44 64 A 20 10 0 0 0 84 64 M 44 76 A 20 10 0 0 0 84 76 M 44 88 A 20 10 0 0 0 84 88", stroke=neon_stroke("#39FF14", 6))])
    else:
        t = gen_doc(f)
    templates.append(t)

print(f"Generating {len(templates)} icons using UIForgeEngine...")

for t in templates:
    # Ensure UIForgeEngine.generate_asset receives the template
    try:
        engine.generate_asset(t)
    except Exception as e:
        print(f"Error generating {t.get('name')}: {e}")
    
print(f"Finished generating all {len(templates)} icons to {OUTPUT_DIR}")
