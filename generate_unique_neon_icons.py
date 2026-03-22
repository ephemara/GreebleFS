import sys
import os
from pathlib import Path

sys.path.insert(0, r"M:\PyMono\UIForge")
sys.path.insert(0, r"M:\PyMono")

try:
    from core import UIForgeEngine
    from llm_api import circle, icon, line, path, polygon, rect, solid, stroke
except ModuleNotFoundError:
    print("UIForge not found!")
    sys.exit(1)

OUTPUT_DIR = Path(r"M:\OverlayTerm\output\vintage-terminal-unique")
os.makedirs(OUTPUT_DIR, exist_ok=True)
engine = UIForgeEngine(output_dir=OUTPUT_DIR)

def neon(color, w=6): return stroke(color, width=w, cap="round", join="round")
def crt(): return solid("#0a0a0a")
def fill(c): return solid(c)

def build_icon(name, layers):
    # Give every single icon a base subtle CRT glow or scanline outline if needed,
    # but here we just pass the completely unique layers exactly as requested.
    return icon(name, *layers, category="files", formats=["svg"], size=128)

def build_folder(name, color_theme, accent, is_open, unique_glyph=None):
    layers = []
    if is_open:
        layers.append(rect(16, 32, 96, 72, rx=4, fill=crt(), stroke=neon(accent, 8))) # back
        if unique_glyph: layers.extend(unique_glyph) # inner content
        else: layers.append(rect(28, 24, 72, 72, fill=crt(), stroke=neon("#ffffff", 4))) # generic paper
        layers.append(polygon([(8,64), (120,64), (112,112), (16,112)], fill=crt(), stroke=neon(color_theme, 8))) # front
    else:
        layers.append(rect(16, 24, 40, 24, rx=4, fill=crt(), stroke=neon(accent, 8))) # tab
        layers.append(rect(16, 40, 96, 72, rx=8, fill=crt(), stroke=neon(color_theme, 8))) # front
        if unique_glyph: layers.extend(unique_glyph)
        else: layers.append(line(32, 64, 96, 64, stroke=neon(accent, 6)))
        
    n = f"folder_{name}_open" if is_open and name != "folder" else (f"folder_open" if is_open else (f"folder_{name}" if name != "folder" else "folder"))
    return icon(n, *layers, category="folders", formats=["svg"], size=128)

items = []

# --- UNIQUE FILES ---
# I am physically hardcoding 70+ completely distinct topological patterns to guarantee no lazy repetitive geometry.

files_map = {
    "app": [rect(24, 24, 80, 80, rx=8, fill=crt(), stroke=neon("#00FFFF", 8)), line(24, 40, 104, 40, stroke=neon("#FF00FF", 6)), circle(36, 32, 4, fill=fill("#FFFF00"))],
    "exe": [rect(24, 24, 80, 80, rx=8, fill=crt(), stroke=neon("#ffffff", 8)), line(24, 40, 104, 40, stroke=neon("#00FF00", 6)), path("M 48 72 L 64 56 L 80 72 M 64 56 L 64 88", stroke=neon("#FFFF00", 8))],
    "archive": [rect(32, 24, 64, 80, rx=6, fill=crt(), stroke=neon("#FF5500", 8)), rect(48, 24, 32, 24, fill=fill("#111111"), stroke=neon("#FFFF00", 6)), circle(64, 80, 12, stroke=neon("#FF00FF", 6))],
    "zip": [rect(32, 16, 64, 96, rx=4, fill=crt(), stroke=neon("#FFFF00", 8)), path("M 64 16 L 64 64", stroke=neon("#00FFFF", 8)), polygon([(56,64), (72,64), (64,80)], fill=fill("#FF00FF"))],
    "audio": [circle(64, 64, 40, fill=crt(), stroke=neon("#FF00FF", 8)), circle(64, 64, 12, stroke=neon("#00FFFF", 6)), path("M 64 24 L 64 16 M 64 104 L 64 112 M 24 64 L 16 64 M 104 64 L 112 64", stroke=neon("#FFFF00", 6))],
    "video": [rect(16, 32, 96, 64, rx=8, fill=crt(), stroke=neon("#00FFFF", 8)), polygon([(52, 52), (80, 64), (52, 76)], fill=fill("#FF00FF")), circle(24, 40, 4, fill=fill("#FFFF00")), circle(24, 88, 4, fill=fill("#FFFF00")), circle(104, 40, 4, fill=fill("#FFFF00")), circle(104, 88, 4, fill=fill("#FFFF00"))],
    "image": [rect(16, 24, 96, 80, rx=4, fill=crt(), stroke=neon("#FFFF00", 8)), circle(40, 48, 12, stroke=neon("#FF00FF", 6)), path("M 16 104 L 48 56 L 72 80 L 88 64 L 112 104", stroke=neon("#00FFFF", 8))],
    "font": [path("M 40 96 L 64 32 L 88 96 M 50 76 L 78 76", stroke=neon("#FF00FF", 12))],
    "lock": [rect(40, 56, 48, 48, rx=8, fill=crt(), stroke=neon("#FFFF00", 8)), path("M 48 56 L 48 40 A 16 16 0 0 1 80 40 L 80 56", stroke=neon("#00FF00", 8)), circle(64, 80, 6, fill=fill("#FF00FF"))],
    "database": [circle(64, 32, 24, stroke=neon("#39FF14", 8)), path("M 40 32 L 40 96 A 24 16 0 0 0 88 96 L 88 32", stroke=neon("#39FF14", 8), fill=crt()), path("M 40 64 A 24 16 0 0 0 88 64", stroke=neon("#00FFFF", 6))],
    "sql": [circle(64, 32, 24, stroke=neon("#FF00FF", 8)), path("M 40 32 L 40 96 A 24 16 0 0 0 88 96 L 88 32", stroke=neon("#FF00FF", 8), fill=crt()), path("M 64 64 L 88 64", stroke=neon("#FFFF00", 6))],
    
    # LANGUAGES
    "python": [path("M 48 80 L 48 48 L 80 48", stroke=neon("#FFFF00", 16)), path("M 80 48 L 80 80 L 48 80", stroke=neon("#00FFFF", 16)), circle(56, 40, 4, fill=fill("#000000")), circle(72, 88, 4, fill=fill("#000000"))],
    "rust": [circle(64, 64, 32, stroke=neon("#FF3300", 12)), circle(64, 64, 16, stroke=neon("#FF00FF", 6)), path("M 32 64 L 16 64 M 96 64 L 112 64 M 64 32 L 64 16 M 64 96 L 64 112", stroke=neon("#FF3300", 8))],
    "cpp": [polygon([(64, 16), (104, 36), (104, 92), (64, 112), (24, 92), (24, 36)], fill=crt(), stroke=neon("#00FFFF", 8)), path("M 72 64 L 96 64 M 84 52 L 84 76 M 40 64 L 64 64 M 52 52 L 52 76", stroke=neon("#FF00FF", 6))],
    "c": [polygon([(64, 16), (104, 36), (104, 92), (64, 112), (24, 92), (24, 36)], fill=crt(), stroke=neon("#00FFFF", 8)), path("M 80 48 L 56 48 L 56 80 L 80 80", stroke=neon("#00FF00", 10))],
    "csharp": [polygon([(64, 16), (104, 36), (104, 92), (64, 112), (24, 92), (24, 36)], fill=crt(), stroke=neon("#00FFFF", 8)), path("M 64 48 L 96 48 M 64 80 L 96 80 M 76 36 L 76 92 M 88 36 L 88 92 M 56 48 L 40 48 L 40 80 L 56 80", stroke=neon("#FFFF00", 6))],
    "java": [path("M 48 80 C 48 104 80 104 80 80 L 80 64 L 48 64 Z", fill=crt(), stroke=neon("#FF3300", 8)), path("M 80 64 C 96 64 96 80 80 80", stroke=neon("#FF3300", 8)), path("M 56 48 Q 64 32 56 16 M 72 48 Q 80 32 72 16", stroke=neon("#00FFFF", 6))],
    "javascript": [rect(24, 24, 80, 80, rx=12, fill=crt(), stroke=neon("#FFFF00", 12)), path("M 64 48 L 64 80 C 64 96 48 96 48 80 M 80 48 L 96 48 M 80 64 L 96 64 M 80 80 L 96 80", stroke=neon("#00FFFF", 8))],
    "typescript": [rect(24, 24, 80, 80, rx=12, fill=crt(), stroke=neon("#00FFFF", 12)), path("M 40 48 L 64 48 M 52 48 L 52 80 M 72 48 L 88 48 M 72 64 L 88 64 M 72 80 L 88 80", stroke=neon("#FF00FF", 8))],
    "html": [path("M 40 40 L 16 64 L 40 88 M 88 40 L 112 64 L 88 88", stroke=neon("#FF3300", 12)), path("M 72 32 L 56 96", stroke=neon("#FFFF00", 8))],
    "css": [path("M 40 40 L 16 64 L 40 88 M 88 40 L 112 64 L 88 88", stroke=neon("#00FFFF", 12)), circle(64, 64, 16, stroke=neon("#FF00FF", 8))],
    "go": [circle(48, 64, 24, fill=crt(), stroke=neon("#00FFFF", 8)), circle(80, 64, 24, fill=crt(), stroke=neon("#00FFFF", 8)), circle(40, 64, 4, fill=fill("#FFFF00")), circle(88, 64, 4, fill=fill("#FFFF00"))],
    "ruby": [polygon([(64, 16), (104, 48), (64, 112), (24, 48)], fill=crt(), stroke=neon("#FF0033", 10)), line(40, 32, 88, 32, stroke=neon("#FF0033", 6)), line(64, 16, 64, 112, stroke=neon("#FF00FF", 4))],
    "php": [ellipse:=rect(24, 40, 80, 48, rx=24, fill=crt(), stroke=neon("#FF00FF", 8)), path("M 48 56 Q 32 56 32 72", stroke=neon("#00FFFF", 8)), path("M 80 56 Q 96 56 96 72", stroke=neon("#00FFFF", 8))],
    "json": [path("M 56 32 Q 40 32 40 64 Q 40 96 56 96 M 72 32 Q 88 32 88 64 Q 88 96 72 96", stroke=neon("#FFFF00", 10)), circle(64, 64, 4, fill=fill("#FF00FF"))],
    "markdown": [rect(16, 32, 96, 64, rx=4, fill=crt(), stroke=neon("#00FF00", 8)), path("M 32 76 L 32 52 L 48 68 L 64 52 L 64 76 M 80 52 L 80 80 M 72 72 L 80 80 L 88 72", stroke=neon("#00FFFF", 6))],
    "markdown": [rect(16, 32, 96, 64, rx=4, fill=crt(), stroke=neon("#00FF00", 8)), path("M 32 76 L 32 52 L 48 68 L 64 52 L 64 76 M 80 52 L 80 80 M 72 72 L 80 80 L 88 72", stroke=neon("#00FFFF", 6))],
    "dockerfile": [path("M 24 80 C 64 128 104 80 104 80 Z", fill=fill("#00FFFF")), rect(48, 48, 12, 12, fill=fill("#00FF00")), rect(64, 48, 12, 12, fill=fill("#00FF00")), rect(56, 32, 12, 12, fill=fill("#FF00FF"))],
    "git": [path("M 64 32 L 64 96 M 64 96 L 32 64", stroke=neon("#FF3300", 8)), circle(64, 32, 12, stroke=neon("#00FFFF", 6), fill=crt()), circle(64, 96, 12, stroke=neon("#00FFFF", 6), fill=crt()), circle(32, 64, 12, stroke=neon("#00FFFF", 6), fill=crt())],
    "gitlab": [path("M 64 32 L 64 96 M 64 96 L 32 64", stroke=neon("#FF3300", 8))],
    "gitignore": [path("M 64 32 L 64 96 M 64 96 L 32 64", stroke=neon("#FF00FF", 8)), line(24, 24, 104, 104, stroke=neon("#FF3300", 8))],
    
    "swift": [path("M 104 32 Q 64 16 24 64 Q 64 64 80 96 Q 112 64 104 32 Z", fill=crt(), stroke=neon("#FF5500", 8)), circle(88, 48, 6, fill=fill("#00FFFF"))],
    "kotlin": [path("M 24 24 L 104 24 L 24 104 Z", fill=fill("#00FFFF")), path("M 24 24 L 104 104 L 24 104 Z", fill=fill("#FF00FF"))],
    "dart": [path("M 24 24 L 80 24 L 104 48 L 104 104 L 24 104 Z", fill=crt(), stroke=neon("#00FFFF", 8)), polygon([(48, 48), (80, 48), (80, 80), (48, 80)], fill=fill("#FFFF00"))],
    "lua": [circle(64, 64, 40, fill=crt(), stroke=neon("#0000FF", 10)), circle(80, 48, 12, fill=fill("#FFFF00"))],
    "zig": [path("M 32 32 L 96 32 L 64 64 L 96 64 L 32 96 L 48 64 Z", fill=fill("#FFFF00"), stroke=neon("#FF5500", 4))],
    "elixir": [path("M 64 16 C 96 48 96 96 64 112 C 32 96 32 48 64 16 Z", fill=crt(), stroke=neon("#FF00FF", 8)), circle(64, 80, 12, fill=fill("#00FFFF"))],
    "haskell": [path("M 24 24 L 56 64 L 24 104 M 56 24 L 88 64 L 56 104", stroke=neon("#FF00FF", 10)), line(72, 64, 104, 64, stroke=neon("#00FFFF", 10)), line(84, 80, 104, 80, stroke=neon("#00FFFF", 10))],
    "r": [path("M 32 32 L 32 96", stroke=neon("#00FFFF", 12)), path("M 32 32 L 80 32 C 96 32 96 64 80 64 L 32 64", stroke=neon("#00FFFF", 12)), path("M 64 64 L 96 96", stroke=neon("#FF00FF", 12))],
    "scala": [rect(32, 24, 64, 16, fill=fill("#FF0033")), rect(32, 56, 64, 16, fill=fill("#FF0033")), rect(32, 88, 64, 16, fill=fill("#FF0033"))],
    "clojure": [path("M 64 16 C 16 16 16 112 64 112 C 112 112 112 16 64 16 Z M 48 64 L 80 64 M 64 48 L 64 80", stroke=neon("#39FF14", 8))],
    "erlang": [circle(64, 64, 32, fill=crt(), stroke=neon("#FF0033", 8)), path("M 32 64 Q 64 16 96 64", stroke=neon("#00FFFF", 6)), path("M 32 64 Q 64 112 96 64", stroke=neon("#00FFFF", 6))],
    "ocaml": [path("M 24 40 L 40 40 L 40 88 L 24 88 Z M 56 40 L 72 40 L 72 88 L 56 88 Z M 88 40 L 104 40 L 104 88 L 88 88 Z", fill=fill("#FF5500"))],
    
    "shell": [rect(16, 24, 96, 80, rx=8, fill=crt(), stroke=neon("#00FF00", 8)), path("M 32 48 L 48 64 L 32 80 M 64 80 L 80 80", stroke=neon("#FFFF00", 8))],
    "powershell": [rect(16, 24, 96, 80, rx=8, fill=crt(), stroke=neon("#00FFFF", 8)), path("M 32 48 L 48 64 L 32 80 M 64 80 L 80 80", stroke=neon("#FF00FF", 8))],
    "makefile": [polygon([(48, 16), (80, 16), (96, 32), (96, 112), (32, 112), (32, 32)], fill=crt(), stroke=neon("#FF00FF", 8)), path("M 64 48 L 64 80 M 48 64 L 80 64", stroke=neon("#FFFF00", 8))],
    "cmake": [polygon([(64, 16), (24, 96), (104, 96)], fill=crt(), stroke=neon("#00FFFF", 8)), path("M 64 16 L 64 96", stroke=neon("#FF00FF", 8))],
    "gradle": [path("M 64 24 Q 96 24 96 64 Q 96 104 64 104 Q 32 104 32 64 Q 32 24 64 24 Z", fill=crt(), stroke=neon("#00FFFF", 8)), circle(48, 64, 8, fill=fill("#FFFF00")), circle(80, 64, 8, fill=fill("#FFFF00"))],
    "npm": [rect(24, 40, 80, 48, fill=fill("#FF0033")), rect(32, 56, 16, 16, fill=fill("#ffffff")), rect(80, 56, 16, 16, fill=fill("#ffffff"))],
    "pdf": [path("M 32 16 L 72 16 L 96 40 L 96 112 L 32 112 Z", fill=crt(), stroke=neon("#FF0000", 8)), path("M 72 16 L 72 40 L 96 40", stroke=neon("#FF0000", 8)), path("M 48 64 L 48 88 M 48 76 L 64 76 C 80 76 80 64 64 64 Z", stroke=neon("#FFFF00", 8))],
    "txt": [path("M 32 16 L 72 16 L 96 40 L 96 112 L 32 112 Z", fill=crt(), stroke=neon("#00FFFF", 8)), path("M 48 64 L 80 64 M 48 80 L 80 80 M 48 96 L 64 96", stroke=neon("#FFFF00", 6))],
    "log": [rect(24, 16, 80, 96, rx=4, fill=crt(), stroke=neon("#39FF14", 8)), line(40, 40, 88, 40, stroke=neon("#FF00FF", 6)), line(40, 64, 88, 64, stroke=neon("#FFFF00", 6)), line(40, 88, 72, 88, stroke=neon("#00FFFF", 6))],
    "ini": [rect(24, 24, 80, 80, rx=4, fill=crt(), stroke=neon("#FF00FF", 8)), path("M 40 48 L 40 80 M 56 48 L 56 80 M 72 48 L 72 80 M 88 48 L 88 80", stroke=neon("#00FFFF", 6))],
    "yaml": [rect(24, 24, 80, 80, rx=4, fill=crt(), stroke=neon("#FF0033", 8)), path("M 40 40 L 56 64 L 40 88 M 72 40 L 88 64 L 72 88", stroke=neon("#FFFF00", 6))],
    "toml": [rect(24, 24, 80, 80, rx=4, fill=crt(), stroke=neon("#FF5500", 8)), path("M 32 40 L 96 40 M 64 40 L 64 88 M 32 88 L 96 88", stroke=neon("#00FFFF", 6))],
    "xml": [path("M 24 24 L 104 24 L 104 104 L 24 104 Z", fill=crt(), stroke=neon("#00FFFF", 8)), path("M 48 48 L 32 64 L 48 80 M 80 48 L 96 64 L 80 80 M 64 40 L 56 88", stroke=neon("#FF00FF", 6))],
    "less": [circle(64, 64, 40, fill=crt(), stroke=neon("#00FFFF", 10)), path("M 80 48 L 48 64 L 80 80", stroke=neon("#FFFF00", 8))],
    "sass": [circle(64, 64, 40, fill=fill("#FF00FF")), path("M 48 48 Q 80 48 80 64 Q 64 80 48 80", stroke=neon("#FFFF00", 6))],
    "scss": [circle(64, 64, 40, fill=crt(), stroke=neon("#FF00FF", 10)), path("M 80 48 L 48 64 L 80 80 L 80 48", fill=fill("#FFFF00"))],
    "glsl": [polygon([(64, 16), (104, 88), (24, 88)], fill=crt(), stroke=neon("#00FFFF", 8)), circle(64, 60, 16, fill=fill("#FF00FF"))],
    "hlsl": [polygon([(64, 16), (104, 88), (24, 88)], fill=crt(), stroke=neon("#FFFF00", 8)), rect(48, 56, 32, 24, fill=fill("#FF00FF"))],
    "wgsl": [polygon([(64, 16), (104, 88), (24, 88)], fill=crt(), stroke=neon("#39FF14", 8)), polygon([(64, 40), (80, 72), (48, 72)], fill=fill("#00FFFF"))],
    "spv": [path("M 32 32 C 96 32 96 96 32 96 C 32 32 96 32 96 96", fill=crt(), stroke=neon("#FF5500", 10))],
    "model3d": [polygon([(64, 24), (104, 48), (104, 88), (64, 112), (24, 88), (24, 48)], fill=crt(), stroke=neon("#00FFFF", 8)), path("M 64 24 L 64 64 L 104 88 M 64 64 L 24 88", stroke=neon("#FF00FF", 6))],
    "kain": [polygon([(64, 16), (112, 64), (64, 112), (16, 64)], fill=crt(), stroke=neon("#FFFF00", 8)), path("M 48 32 L 48 96 M 48 64 L 80 32 M 48 64 L 80 96", stroke=neon("#FF00FF", 8))],
    "uasset": [circle(64, 64, 40, fill=crt(), stroke=neon("#FF5500", 8)), path("M 48 48 L 48 88 L 80 64 Z", fill=fill("#00FFFF"))],
    "uproject": [rect(24, 24, 80, 80, rx=12, fill=crt(), stroke=neon("#00FFFF", 8)), path("M 40 40 L 40 88 L 88 64 Z", fill=fill("#FF5500"))],
    "zentako-logo-128": [path("M 64 16 L 104 48 L 88 112 L 40 112 L 24 48 Z", fill=crt(), stroke=neon("#39FF14", 10)), circle(64, 64, 16, fill=fill("#FF00FF"))],
    
    # Generic distinct glyph for leftovers ensures all are unique
    "dll": [rect(24, 24, 80, 80, fill=crt(), stroke=neon("#FF00FF", 6)), path("M 40 40 L 88 88 M 88 40 L 40 88", stroke=neon("#00FFFF", 6))],
    "dmg": [circle(64, 64, 40, fill=crt(), stroke=neon("#ffffff", 8)), circle(88, 40, 16, fill=fill("#111111")), path("M 48 56 Q 64 32 80 56 Q 96 80 64 80 Q 32 80 48 56", fill=fill("#FF00FF"))],
    "deb": [circle(64, 64, 40, fill=crt(), stroke=neon("#FF0000", 8)), path("M 80 48 A 20 20 0 1 0 48 80", stroke=neon("#00FFFF", 6))],
    "env": [rect(24, 32, 80, 64, rx=4, fill=crt(), stroke=neon("#00FF00", 8)), path("M 32 48 L 96 48 M 64 48 L 64 80 M 48 80 L 80 80", stroke=neon("#FFFF00", 6))],
    "editorconfig": [rect(24, 16, 80, 96, rx=4, fill=crt(), stroke=neon("#00FFFF", 8)), line(40, 48, 88, 48, stroke=neon("#FF00FF", 6)), line(40, 64, 88, 64, stroke=neon("#FF00FF", 6)), line(40, 80, 88, 80, stroke=neon("#FF00FF", 6))],
    "ink": [circle(64, 64, 40, fill=fill("#FF00FF")), circle(64, 64, 20, fill=fill("#111111"))],
    "clojure": [path("M 64 16 C 16 16 16 112 64 112 C 112 112 112 16 64 16 Z", fill=crt(), stroke=neon("#39FF14", 8)), path("M 48 64 L 80 64 M 64 48 L 64 80", stroke=neon("#FF00FF", 8))],
    "c": [polygon([(64, 16), (104, 36), (104, 92), (64, 112), (24, 92), (24, 36)], fill=crt(), stroke=neon("#00FFFF", 8)), path("M 80 48 L 56 48 L 56 80 L 80 80", stroke=neon("#00FF00", 10))]
}

files = [
    "app", "archive", "audio", "c", "clojure", "cmake", "cpp", "csharp", "css", "dart", 
    "database", "deb", "dll", "dmg", "dockerfile", "editorconfig", "elixir", "env", "erlang", "exe",
    "font", "git", "gitignore", "glsl", "go", "gradle", "haskell", "hlsl", "html", "image", "ini", 
    "ink", "java", "javascript", "json", "kain", "kotlin", "less", "lock", "log", "lua", "makefile", 
    "markdown", "model3d", "npm", "ocaml", "pdf", "php", "powershell", "python", "r", "ruby", "rust", 
    "sass", "scala", "scss", "shell", "spv", "sql", "swift", "toml", "txt", "typescript", "uasset", 
    "uproject", "video", "wgsl", "xml", "yaml", "zentako-logo-128", "zig", "zip"
]

for name in files:
    if name in files_map:
        layers = files_map[name]
    else:
        # Generate an algorithmic *highly robust & unique* polygon set for unmapped ones
        h = int(hashlib.md5(name.encode()).hexdigest(), 16)
        cA = PALETTE[h % len(PALETTE)]
        cB = PALETTE[(h+1) % len(PALETTE)]
        pts = [(64 + 40*__import__('math').cos(i), 64 + 40*__import__('math').sin(i)) for i in range(h%5 + 3)]
        layers = [polygon(pts, fill=crt(), stroke=neon(cA, 8)), circle(64, 64, (h%20)+10, fill=fill(cB))]
    
    items.append(build_icon(name, layers))


folders = [
    "folder", "ai", "api", "assets", "build", "components", "config", "database",
    "docs", "engine", "packages", "plugins", "public", "scripts", "src", "test"
]

folders_map = {
    "folder": ("#FFFF00", "#FF00FF", None),
    "ai": ("#FF00FF", "#00FFFF", [circle(64, 72, 16, stroke=neon("#FFFF00", 6))]),
    "api": ("#00FFFF", "#39FF14", [path("M 48 72 L 80 72 M 64 56 L 64 88", stroke=neon("#FF00FF", 6))]),
    "assets": ("#39FF14", "#FFFF00", [rect(48, 56, 32, 32, fill=fill("#FF00FF"))]),
    "build": ("#FF5500", "#00FFFF", [polygon([(48, 88), (64, 56), (80, 88)], fill=fill("#FFFF00"))]),
    "components": ("#FFFF00", "#FF00FF", [rect(40, 56, 16, 16, fill=fill("#00FFFF")), rect(72, 56, 16, 16, fill=fill("#00FFFF"))]),
    "config": ("#FF00FF", "#39FF14", [circle(64, 72, 16, fill=fill("#FFFF00"))]),
    "database": ("#00FFFF", "#FF5500", [path("M 48 56 L 80 56 M 48 72 L 80 72 M 48 88 L 80 88", stroke=neon("#FFFF00", 6))]),
    "docs": ("#FFFF00", "#FF00FF", [path("M 48 56 L 80 56 M 48 72 L 80 72 M 48 88 L 64 88", stroke=neon("#00FFFF", 6))]),
    "engine": ("#FF5500", "#00FFFF", [polygon([(48, 56), (80, 56), (64, 88)], fill=fill("#FF00FF"))]),
    "packages": ("#FF00FF", "#FFFF00", [polygon([(64, 48), (88, 64), (64, 80), (40, 64)], stroke=neon("#00FFFF", 6), fill=crt())]),
    "plugins": ("#39FF14", "#FF00FF", [path("M 64 48 L 64 96 M 48 72 L 80 72", stroke=neon("#FFFF00", 6))]),
    "public": ("#00FFFF", "#FF5500", [circle(64, 72, 16, stroke=neon("#FF00FF", 6)), circle(64, 72, 4, fill=fill("#FFFF00"))]),
    "scripts": ("#FFFF00", "#39FF14", [path("M 48 56 L 64 72 L 48 88 M 80 88 L 96 88", stroke=neon("#FF00FF", 6))]),
    "src": ("#FF5500", "#00FFFF", [path("M 56 56 L 40 72 L 56 88 M 72 56 L 88 72 L 72 88", stroke=neon("#FFFF00", 6))]),
    "test": ("#39FF14", "#FF00FF", [path("M 48 56 L 80 56 M 64 56 L 64 88 L 48 88", stroke=neon("#00FFFF", 6))])
}

for name in folders:
    theme, acc, g = folders_map[name]
    items.append(build_folder(name, theme, acc, False, g))
    items.append(build_folder(name, theme, acc, True, g))

print(f"Generating {len(items)} UNIQUE icons using UIForgeEngine...")
for t in items:
    try: engine.generate_asset(t)
    except Exception as e: print(f"Error generating {t.get('name')}: {e}")
print(f"Finished generating all UNIQUE icons to {OUTPUT_DIR}")
