#!/usr/bin/env python3
"""
Vintage Terminal Icon Theme Generator
Style: Neon CRT terminal, vibrant phosphor colors on dark backgrounds.
Like an Apple Mac SE in 1987 hooked up to a neon-lit arcade cabinet.
Every single icon has UNIQUE geometry - no copy-paste shapes.
Output: SVG files in M:/OverlayTerm/output/vintage-terminal-final/icons/
"""

from pathlib import Path

OUT = Path(r"M:\OverlayTerm\output\vintage-terminal-final\icons")
OUT.mkdir(parents=True, exist_ok=True)

# Color palette - neon phosphor colors on CRT black
BG      = "#0D0D0D"  # CRT black
CYAN    = "#00FFFF"
MAGENTA = "#FF00FF"
YELLOW  = "#FFFF00"
GREEN   = "#39FF14"
ORANGE  = "#FF6B00"
RED     = "#FF2D55"
WHITE   = "#F0F0F0"
BLUE    = "#00AAFF"
PURPLE  = "#CC00FF"

def svg(w, h, *shapes):
    inner = "\n  ".join(shapes)
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" xmlns="http://www.w3.org/2000/svg">\n  {inner}\n</svg>\n'

def save(name, content):
    (OUT / f"{name}.svg").write_text(content, encoding="utf-8")
    print(f"  OK {name}.svg")

# ─────────────────────────────────────────────
#  HELPER SHAPES
# ─────────────────────────────────────────────
def rect(x, y, w, h, rx=0, fill="none", stroke="none", sw=2, op=1.0):
    s = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    r = f' rx="{rx}"' if rx else ""
    o = f' opacity="{op}"' if op != 1.0 else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}"{r} {s}{o}/>'

def circle(cx, cy, r, fill="none", stroke="none", sw=2, op=1.0):
    o = f' opacity="{op}"' if op != 1.0 else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{o}/>'

def line(x1, y1, x2, y2, stroke=WHITE, sw=2, cap="round"):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"/>'

def poly(pts, fill="none", stroke="none", sw=2, op=1.0):
    p = " ".join(f"{x},{y}" for x,y in pts)
    o = f' opacity="{op}"' if op != 1.0 else ""
    return f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{o}/>'

def path(d, fill="none", stroke=WHITE, sw=2, cap="round", join="round", dash=""):
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}" stroke-linejoin="{join}"{da}/>'

def text(x, y, content, fill=WHITE, size=10, weight="bold", anchor="middle", font="monospace"):
    return f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{content}</text>'

def bg_rect(color=BG):
    return rect(0, 0, 32, 32, fill=color)

# Scanline effect overlay — vintage CRT feel
def scanlines(op=0.06):
    lines = []
    for y in range(2, 32, 4):
        lines.append(rect(0, y, 32, 2, fill=WHITE, op=op))
    return "\n  ".join(lines)

# ─────────────────────────────────────────────
#  FOLDER ICONS — unique badge per folder type
# ─────────────────────────────────────────────

def folder_base(tab_color, body_color):
    """Pixel-art style folder — CRT terminal aesthetic"""
    return [
        bg_rect(),
        # Body
        path(f"M 2 10 L 2 26 Q 2 28 4 28 L 28 28 Q 30 28 30 26 L 30 12 Q 30 10 28 10 L 16 10 L 14 8 L 4 8 Q 2 8 2 10 Z",
             fill=body_color, stroke="none"),
        # Highlight top edge
        line(2, 10, 30, 10, stroke=WHITE, sw=1),
        # Subtle grid inside
        line(10, 16, 10, 26, stroke=WHITE, sw=1, cap="butt"),
        line(18, 16, 18, 26, stroke=WHITE, sw=1, cap="butt"),
        line(26, 16, 26, 26, stroke=WHITE, sw=1, cap="butt"),
        line(2, 20, 30, 20, stroke=WHITE, sw=1, cap="butt"),
    ]

def folder_open_base(tab_color, body_color):
    """Open folder — front panel swung open"""
    return [
        bg_rect(),
        # Back panel
        rect(2, 10, 28, 18, rx=2, fill="#1A1A1A", stroke=body_color, sw=1),
        # Front flap angled
        path("M 1 18 L 5 28 L 27 28 L 31 18 Z", fill=body_color, stroke="none"),
        # Tab
        path("M 2 10 L 2 18 L 14 18 L 16 14 L 4 14 L 4 10 Z", fill=tab_color, stroke="none"),
        line(1, 18, 31, 18, stroke=WHITE, sw=1),
    ]

def save_folder(name, tab_c, body_c, badge_shapes, open_badge_shapes=None):
    closed = folder_base(tab_c, body_c) + badge_shapes
    save(name, svg(32, 32, *closed))
    opn = folder_open_base(tab_c, body_c) + (open_badge_shapes or badge_shapes)
    save(f"{name}_open", svg(32, 32, *opn))

# Generic folder
save_folder("folder", YELLOW, "#4A3800",
    [line(8, 18, 24, 18, stroke=YELLOW, sw=2),
     line(8, 23, 20, 23, stroke=YELLOW, sw=1)])

# src — angle brackets < >
save_folder("folder_src", CYAN, "#003A3A",
    [path("M 8 16 L 5 19 L 8 22", stroke=CYAN, sw=2),
     path("M 14 16 L 17 19 L 14 22", stroke=CYAN, sw=2),
     line(11, 14, 10, 24, stroke=GREEN, sw=1)])

# components — four squares like a grid
save_folder("folder_components", MAGENTA, "#3A003A",
    [rect(7, 15, 4, 4, fill=MAGENTA, sw=0),
     rect(13, 15, 4, 4, fill=MAGENTA, op=0.7, sw=0),
     rect(7, 21, 4, 4, fill=MAGENTA, op=0.7, sw=0),
     rect(13, 21, 4, 4, fill=WHITE, op=0.5, sw=0)])

# docs — lined paper
save_folder("folder_docs", YELLOW, "#3A3000",
    [line(8, 16, 22, 16, stroke=YELLOW, sw=1),
     line(8, 19, 22, 19, stroke=YELLOW, sw=1),
     line(8, 22, 18, 22, stroke=YELLOW, sw=1)])

# config — sliders
save_folder("folder_config", ORANGE, "#3A1800",
    [line(7, 17, 25, 17, stroke=ORANGE, sw=1),
     line(7, 22, 25, 22, stroke=ORANGE, sw=1),
     circle(12, 17, 2, fill=ORANGE, sw=0),
     circle(20, 22, 2, fill=ORANGE, sw=0)])

# build — wrench / hammer
save_folder("folder_build", RED, "#3A0010",
    [path("M 8 23 L 14 17", stroke=WHITE, sw=3),
     circle(15, 16, 3, stroke=RED, sw=2),
     path("M 18 19 L 22 23", stroke=WHITE, sw=3)])

# assets — image frame with sun
save_folder("folder_assets", MAGENTA, "#2A002A",
    [rect(7, 15, 14, 10, stroke=MAGENTA, sw=1),
     circle(10, 18, 2, fill=YELLOW, sw=0),
     poly([(7,25),(13,19),(17,23),(21,25)], fill=MAGENTA, sw=0)])

# packages — box / crate
save_folder("folder_packages", BLUE, "#001833",
    [poly([(16,14),(23,17),(23,24),(16,27),(9,24),(9,17)], stroke=BLUE, sw=1),
     line(16, 14, 16, 27, stroke=BLUE, sw=1),
     line(9, 17, 23, 17, stroke=BLUE, sw=1)])

# plugins — plug icon
save_folder("folder_plugins", PURPLE, "#1A0033",
    [rect(11, 18, 10, 7, rx=2, stroke=PURPLE, sw=2),
     line(14, 15, 14, 18, stroke=PURPLE, sw=2),
     line(18, 15, 18, 18, stroke=PURPLE, sw=2),
     line(16, 25, 16, 28, stroke=PURPLE, sw=2)])

# database — stacked discs
save_folder("folder_database", CYAN, "#003A3A",
    [path("M 9 16 A 7 3 0 0 1 23 16 A 7 3 0 0 1 9 16 Z", fill="#003A3A", stroke=CYAN, sw=1),
     line(9, 16, 9, 22, stroke=CYAN, sw=1),
     line(23, 16, 23, 22, stroke=CYAN, sw=1),
     path("M 9 22 A 7 3 0 0 0 23 22", stroke=CYAN, sw=1)])

# api — network nodes
save_folder("folder_api", GREEN, "#003A00",
    [circle(16, 19, 2, fill=GREEN, sw=0),
     circle(10, 23, 2, fill=GREEN, sw=0),
     circle(22, 23, 2, fill=GREEN, sw=0),
     line(16, 19, 10, 23, stroke=GREEN, sw=1),
     line(16, 19, 22, 23, stroke=GREEN, sw=1)])

# scripts — terminal prompt
save_folder("folder_scripts", GREEN, "#001A00",
    [path("M 8 17 L 12 20 L 8 23", stroke=GREEN, sw=2),
     line(14, 23, 22, 23, stroke=GREEN, sw=2)])

# public — globe
save_folder("folder_public", BLUE, "#001433",
    [circle(16, 20, 6, stroke=BLUE, sw=1),
     line(10, 20, 22, 20, stroke=BLUE, sw=1),
     line(16, 14, 16, 26, stroke=BLUE, sw=1),
     path("M 11 17 Q 16 15 21 17", stroke=BLUE, sw=1),
     path("M 11 23 Q 16 25 21 23", stroke=BLUE, sw=1)])

# engine — gear
save_folder("folder_engine", ORANGE, "#2A1000",
    [circle(16, 20, 4, stroke=ORANGE, sw=2),
     line(16, 14, 16, 12, stroke=ORANGE, sw=2),
     line(16, 26, 16, 28, stroke=ORANGE, sw=2),
     line(10, 20, 8, 20, stroke=ORANGE, sw=2),
     line(22, 20, 24, 20, stroke=ORANGE, sw=2)])

# test — beaker / flask
save_folder("folder_test", GREEN, "#001A00",
    [path("M 12 14 L 12 19 L 8 25 Q 7 27 9 27 L 23 27 Q 25 27 24 25 L 20 19 L 20 14 Z",
          fill="#001A00", stroke=GREEN, sw=1),
     line(12, 14, 20, 14, stroke=GREEN, sw=2),
     line(9, 23, 19, 23, stroke=GREEN, sw=1)])

# ai — star / sparkle
save_folder("folder_ai", PURPLE, "#1A0033",
    [poly([(16,14),(17.5,18),(22,18),(18.5,20.5),(20,25),(16,22.5),(12,25),(13.5,20.5),(10,18),(14.5,18)],
          fill=PURPLE, sw=0)])


# ─────────────────────────────────────────────
#  FILE ICONS — each fully unique geometry
# ─────────────────────────────────────────────

# ── Programming Languages ──

# Rust — gear with crab claws
save("rust", svg(32,32,
    bg_rect(),
    circle(16, 16, 9, stroke=ORANGE, sw=3),
    circle(16, 16, 4, fill=ORANGE, sw=0),
    line(16, 7, 16, 4, stroke=ORANGE, sw=3),
    line(16, 25, 16, 28, stroke=ORANGE, sw=3),
    line(7, 16, 4, 16, stroke=ORANGE, sw=3),
    line(25, 16, 28, 16, stroke=ORANGE, sw=3),
    # Gear teeth at diagonals
    line(9,9,7,7, stroke=ORANGE, sw=2),
    line(23,9,25,7, stroke=ORANGE, sw=2),
    line(9,23,7,25, stroke=ORANGE, sw=2),
    line(23,23,25,25, stroke=ORANGE, sw=2),
))

# Python — two intertwined snakes
save("python", svg(32,32,
    bg_rect(),
    # Blue snake top-left
    path("M 10 6 Q 6 6 6 10 L 6 14 Q 6 16 10 16 L 22 16 Q 26 16 26 20 L 26 24 Q 26 28 22 28",
         stroke=BLUE, sw=3),
    # Yellow snake bottom-right
    path("M 22 6 Q 26 6 26 10 L 26 14 Q 26 16 22 16 L 10 16 Q 6 16 6 20 L 6 24 Q 6 28 10 28",
         stroke=YELLOW, sw=3),
    circle(10, 6, 3, fill=BLUE, sw=0),
    circle(22, 6, 3, fill=YELLOW, sw=0),
    circle(9, 5, 1, fill=WHITE, sw=0),
    circle(23, 5, 1, fill=WHITE, sw=0),
))

# JavaScript — yellow square with JS lightning
save("javascript", svg(32,32,
    bg_rect(),
    rect(4, 4, 24, 24, rx=3, fill=YELLOW, sw=0),
    path("M 10 8 L 10 20 Q 10 24 6 24", stroke=BG, sw=3),
    path("M 18 8 L 18 20 Q 18 24 22 24 Q 26 24 26 20", stroke=BG, sw=3),
))

# TypeScript — blue shield
save("typescript", svg(32,32,
    bg_rect(),
    path("M 16 4 L 28 8 L 28 18 Q 28 26 16 30 Q 4 26 4 18 L 4 8 Z",
         fill=BLUE, sw=0),
    line(10, 16, 22, 16, stroke=WHITE, sw=3),
    line(16, 8, 16, 24, stroke=WHITE, sw=3),
))

# C — bold arc
save("c", svg(32,32,
    bg_rect(),
    circle(16, 16, 12, stroke=CYAN, sw=4),
    rect(16, 4, 12, 24, fill=BG, sw=0),  # cut right half
    path("M 28 10 Q 22 4 16 4", stroke=CYAN, sw=4),
    path("M 28 22 Q 22 28 16 28", stroke=CYAN, sw=4),
))

# C++ — hexagon with ++ marks
save("cpp", svg(32,32,
    bg_rect(),
    poly([(16,4),(26,9),(26,23),(16,28),(6,23),(6,9)], stroke=BLUE, sw=2),
    line(20, 13, 20, 19, stroke=CYAN, sw=2),
    line(17, 16, 23, 16, stroke=CYAN, sw=2),
    line(25, 13, 25, 19, stroke=CYAN, sw=2),
    line(22, 16, 28, 16, stroke=CYAN, sw=2),
    # C arc clip inside hex
    path("M 13 11 Q 7 16 13 21", stroke=CYAN, sw=2),
))

# C# — square with # hash mark
save("csharp", svg(32,32,
    bg_rect(),
    rect(4, 4, 24, 24, rx=3, fill=GREEN, sw=0),
    line(11, 9, 9, 23, stroke=BG, sw=3),
    line(17, 9, 15, 23, stroke=BG, sw=3),
    line(8, 14, 18, 14, stroke=BG, sw=3),
    line(7, 19, 17, 19, stroke=BG, sw=3),
))

# Java — coffee cup with steam
save("java", svg(32,32,
    bg_rect(),
    path("M 8 14 L 8 26 Q 8 28 10 28 L 22 28 Q 24 28 24 26 L 24 14 Z",
         fill=RED, sw=0),
    rect(8, 12, 16, 3, fill=RED, sw=0),
    path("M 24 16 Q 28 16 28 20 Q 28 24 24 24", stroke=RED, sw=2),
    path("M 12 8 Q 11 10 12 12", stroke=ORANGE, sw=2),
    path("M 16 6 Q 15 8 16 10", stroke=ORANGE, sw=2),
    path("M 20 8 Q 19 10 20 12", stroke=ORANGE, sw=2),
))

# Go — gopher face (simplified)
save("go", svg(32,32,
    bg_rect(),
    circle(16, 16, 10, fill=CYAN, sw=0),
    circle(16, 11, 6, fill=CYAN, sw=0),
    circle(10, 8, 3, fill=CYAN, sw=0),
    circle(22, 8, 3, fill=CYAN, sw=0),
    circle(13, 12, 2, fill=WHITE, sw=0),
    circle(19, 12, 2, fill=WHITE, sw=0),
    circle(13, 12, 1, fill=BG, sw=0),
    circle(19, 12, 1, fill=BG, sw=0),
))

# Ruby — gem diamond
save("ruby", svg(32,32,
    bg_rect(),
    poly([(16,4),(28,12),(16,28),(4,12)], fill=RED, sw=0),
    poly([(16,4),(28,12),(4,12)], fill="#FF6B80", sw=0),
    line(16, 4, 16, 28, stroke=WHITE, sw=1),
    line(4, 12, 28, 12, stroke=WHITE, sw=1),
))

# PHP — elephant (simplified)
save("php", svg(32,32,
    bg_rect(),
    circle(14, 15, 8, fill=PURPLE, sw=0),
    rect(14, 7, 14, 16, rx=7, fill=PURPLE, sw=0),
    # Trunk
    path("M 6 17 Q 4 20 4 23 Q 4 26 7 26", stroke=PURPLE, sw=3),
    circle(13, 14, 1, fill=WHITE, sw=0),
))

# Swift — swooping bird/wing
save("swift", svg(32,32,
    bg_rect(),
    path("M 28 8 Q 20 4 8 16 Q 16 16 18 22 Q 22 14 28 8 Z",
         fill=ORANGE, sw=0),
    circle(22, 11, 2, fill=WHITE, sw=0),
))

# Kotlin — K-shaped triangle pair
save("kotlin", svg(32,32,
    bg_rect(),
    poly([(4,4),(28,4),(4,28)], fill=PURPLE, sw=0),
    poly([(4,28),(28,4),(28,28)], fill=BLUE, sw=0),
))

# Dart — dart / stylized D
save("dart", svg(32,32,
    bg_rect(),
    path("M 6 6 L 28 6 L 28 26 Q 28 28 26 28 L 14 28 Q 8 28 6 22 Z",
         fill=BLUE, sw=0),
    circle(12, 18, 5, fill=BG, sw=0),
))

# Lua — moon with a dot (classic Lua logo vibe)
save("lua", svg(32,32,
    bg_rect(),
    circle(14, 17, 11, fill=BLUE, sw=0),
    circle(19, 11, 9, fill=BG, sw=0),
    circle(24, 24, 3, fill=BLUE, sw=0),
))

# Zig — lightning Z
save("zig", svg(32,32,
    bg_rect(),
    path("M 6 8 L 26 8 L 10 24 L 26 24", stroke=YELLOW, sw=4),
))

# Elixir — teardrop / potion
save("elixir", svg(32,32,
    bg_rect(),
    path("M 16 4 Q 22 8 22 16 Q 22 24 16 28 Q 10 24 10 16 Q 10 8 16 4 Z",
         fill=PURPLE, sw=0),
    circle(13, 13, 3, fill=WHITE, op=0.5, sw=0),
))

# Haskell — lambda λ
save("haskell", svg(32,32,
    bg_rect(),
    path("M 4 28 L 14 14 L 4 4", stroke=PURPLE, sw=3),
    path("M 14 14 L 28 28", stroke=PURPLE, sw=3),
    line(18, 16, 28, 16, stroke=CYAN, sw=3),
))

# R — statistical lens + R
save("r", svg(32,32,
    bg_rect(),
    circle(13, 14, 9, stroke=BLUE, sw=3),
    path("M 13 9 L 13 19 M 13 13 L 19 13 Q 22 13 22 16 Q 22 19 19 19 L 13 19 M 19 19 L 25 25",
         stroke=BLUE, sw=2),
))

# Scala — staircase bars
save("scala", svg(32,32,
    bg_rect(),
    rect(4, 20, 8, 8, fill=RED, sw=0),
    rect(12, 14, 8, 14, fill=RED, sw=0),
    rect(20, 8, 8, 20, fill=RED, sw=0),
))

# Clojure — parentheses + dot
save("clojure", svg(32,32,
    bg_rect(),
    path("M 10 8 Q 6 16 10 24", stroke=BLUE, sw=3),
    path("M 22 8 Q 26 16 22 24", stroke=GREEN, sw=3),
    circle(16, 16, 3, fill=BLUE, sw=0),
))

# Erlang — orbital atoms
save("erlang", svg(32,32,
    bg_rect(),
    circle(16, 16, 2, fill=RED, sw=0),
    path("M 4 16 Q 16 4 28 16 Q 16 28 4 16 Z", stroke=RED, sw=2),
    path("M 16 4 Q 4 16 16 28 Q 28 16 16 4 Z", stroke=RED, sw=2),
))

# OCaml — two humps (camel)
save("ocaml", svg(32,32,
    bg_rect(),
    path("M 4 22 L 4 18 Q 4 12 8 12 Q 12 12 12 14 Q 12 10 16 10 Q 20 10 20 14 Q 20 12 24 12 Q 28 12 28 18 L 28 22",
         fill=ORANGE, sw=0),
    line(8, 22, 8, 28, stroke=ORANGE, sw=3),
    line(14, 22, 14, 28, stroke=ORANGE, sw=3),
    line(20, 22, 20, 28, stroke=ORANGE, sw=3),
    line(26, 22, 26, 28, stroke=ORANGE, sw=3),
))

# ── Web / Markup ──

# HTML — funnel/badge shape
save("html", svg(32,32,
    bg_rect(),
    path("M 6 4 L 26 4 L 24 26 L 16 28 L 8 26 Z", fill=ORANGE, sw=0),
    path("M 10 10 L 22 10 L 21 20 L 16 22 L 11 20 Z", fill=BG, sw=0),
    text(16, 20, "5", fill=ORANGE, size=9),
))

# CSS — palette shape
save("css", svg(32,32,
    bg_rect(),
    path("M 16 4 Q 6 4 4 14 Q 4 24 14 26 Q 24 26 26 16 Q 26 6 16 4 Z", fill=BLUE, sw=0),
    circle(22, 22, 4, fill=BG, sw=0),
    circle(22, 22, 2, fill=WHITE, sw=0),
))

# SCSS — circle with S-wave
save("scss", svg(32,32,
    bg_rect(),
    circle(16, 16, 12, fill=MAGENTA, sw=0),
    path("M 10 13 Q 16 10 22 13 Q 16 16 10 19 Q 16 22 22 19",
         stroke=WHITE, fill="none", sw=2),
))

# SASS — same shape different wave
save("sass", svg(32,32,
    bg_rect(),
    circle(16, 16, 12, fill=MAGENTA, sw=0),
    path("M 11 12 Q 21 12 21 16 Q 21 20 11 20", stroke=WHITE, fill="none", sw=3),
))

# LESS — at-sign @
save("less", svg(32,32,
    bg_rect(),
    circle(16, 16, 10, stroke=BLUE, sw=2),
    circle(16, 16, 5, fill=BG, stroke=BLUE, sw=2),
    circle(16, 16, 2, fill=BLUE, sw=0),
    path("M 21 16 Q 26 16 26 22", stroke=BLUE, sw=2),
))

# ── Data / Config ──

# JSON — curly braces
save("json", svg(32,32,
    bg_rect(),
    path("M 12 4 Q 8 4 8 8 L 8 14 Q 8 16 5 16 Q 8 16 8 18 L 8 24 Q 8 28 12 28",
         stroke=YELLOW, sw=2),
    path("M 20 4 Q 24 4 24 8 L 24 14 Q 24 16 27 16 Q 24 16 24 18 L 24 24 Q 24 28 20 28",
         stroke=YELLOW, sw=2),
))

# YAML — indented structure
save("yaml", svg(32,32,
    bg_rect(),
    line(4, 8, 14, 8, stroke=RED, sw=3),
    line(8, 13, 20, 13, stroke=RED, sw=2),
    line(8, 18, 22, 18, stroke=RED, sw=2),
    line(4, 23, 14, 23, stroke=RED, sw=3),
    line(8, 28, 18, 28, stroke=RED, sw=2),
    circle(16, 8, 2, fill=YELLOW, sw=0),
    circle(22, 13, 2, fill=YELLOW, sw=0),
))

# TOML — grid table
save("toml", svg(32,32,
    bg_rect(),
    rect(4, 6, 24, 20, rx=2, stroke=ORANGE, sw=2),
    line(4, 14, 28, 14, stroke=ORANGE, sw=2),
    line(16, 6, 16, 26, stroke=ORANGE, sw=2),
    text(10, 12, "k", fill=ORANGE, size=6, weight="normal"),
    text(22, 12, "v", fill=ORANGE, size=6, weight="normal"),
))

# XML — nested angle brackets
save("xml", svg(32,32,
    bg_rect(),
    path("M 8 8 L 4 16 L 8 24", stroke=BLUE, sw=2),
    path("M 24 8 L 28 16 L 24 24", stroke=BLUE, sw=2),
    path("M 12 12 L 10 16 L 12 20", stroke=CYAN, sw=2),
    path("M 20 12 L 22 16 L 20 20", stroke=CYAN, sw=2),
    circle(16, 16, 2, fill=CYAN, sw=0),
))

# ── Infrastructure ──

# Dockerfile — whale with boxes on back
save("dockerfile", svg(32,32,
    bg_rect(),
    circle(16, 20, 10, fill=BLUE, sw=0),
    rect(9, 13, 4, 4, fill=CYAN, sw=0),
    rect(14, 13, 4, 4, fill=CYAN, sw=0),
    rect(19, 13, 4, 4, fill=CYAN, sw=0),
    path("M 26 18 Q 30 16 28 22", fill=BLUE, sw=0),
    path("M 4 26 Q 10 28 16 26 Q 22 24 28 26", stroke=CYAN, sw=1, fill="none"),
))

# Makefile — hammer hitting nail
save("makefile", svg(32,32,
    bg_rect(),
    rect(6, 18, 10, 10, fill=PURPLE, sw=0),
    path("M 10 18 L 10 8 L 20 8 L 20 12 L 26 12 L 26 16 L 20 16 L 20 18 Z",
         fill=PURPLE, sw=0),
))

# CMake — triangle build
save("cmake", svg(32,32,
    bg_rect(),
    poly([(16,4),(28,28),(4,28)], fill=BLUE, sw=0),
    path("M 16 4 L 28 28", stroke=CYAN, sw=2),
    path("M 16 4 L 4 28", stroke=CYAN, sw=2),
    line(4, 20, 28, 20, stroke=CYAN, sw=1, cap="butt"),
))

# Git — branch diagram
save("git", svg(32,32,
    bg_rect(),
    line(8, 6, 8, 26, stroke=ORANGE, sw=2),
    path("M 8 12 Q 14 12 18 16 L 18 22", stroke=ORANGE, sw=2, fill="none"),
    circle(8, 6, 3, fill=ORANGE, sw=0),
    circle(8, 26, 3, fill=ORANGE, sw=0),
    circle(18, 22, 3, fill=CYAN, sw=0),
    circle(8, 16, 3, fill=ORANGE, sw=0),
))

# Gitignore — git with X
save("gitignore", svg(32,32,
    bg_rect(),
    circle(16, 16, 11, fill=RED, sw=0),
    line(11, 11, 21, 21, stroke=WHITE, sw=3),
    line(21, 11, 11, 21, stroke=WHITE, sw=3),
))

# Gradle — elephant trunk
save("gradle", svg(32,32,
    bg_rect(),
    circle(16, 16, 10, fill=CYAN, sw=0),
    circle(10, 10, 6, fill=CYAN, sw=0),
    path("M 4 14 Q 2 20 4 24 Q 6 26 8 24", stroke=CYAN, sw=3, fill="none"),
    circle(10, 12, 1.5, fill=WHITE, sw=0),
))

# NPM — red box with inner white boxes
save("npm", svg(32,32,
    bg_rect(),
    rect(4, 10, 24, 14, fill=RED, sw=0),
    rect(8, 14, 6, 6, fill=WHITE, sw=0),
    rect(18, 14, 6, 6, fill=WHITE, sw=0),
))

# ── Tools / Config ──

# Shell — terminal prompt
save("shell", svg(32,32,
    bg_rect(),
    rect(3, 5, 26, 22, rx=3, fill="#001A00", stroke=GREEN, sw=2),
    path("M 7 12 L 12 16 L 7 20", stroke=GREEN, sw=2),
    line(14, 20, 22, 20, stroke=GREEN, sw=2),
    circle(26, 7, 1.5, fill=GREEN, sw=0),
))

# Powershell — blue terminal with PS glyph
save("powershell", svg(32,32,
    bg_rect(),
    rect(3, 5, 26, 22, rx=3, fill="#001033", stroke=BLUE, sw=2),
    path("M 7 12 L 13 16 L 7 20", stroke=BLUE, sw=2),
    line(15, 20, 23, 20, stroke=BLUE, sw=2),
    path("M 18 8 L 16 14 L 18 14 L 16 20", stroke=YELLOW, sw=2),
))

# Env — key=value terminal
save("env", svg(32,32,
    bg_rect(),
    rect(3, 3, 26, 26, rx=2, stroke=YELLOW, sw=2),
    text(5, 13, "KEY=", fill=YELLOW, size=6, anchor="start"),
    text(5, 21, "VAL", fill=GREEN, size=6, anchor="start"),
    circle(26, 6, 2, fill=YELLOW, sw=0),
))

# EditorConfig — lined settings doc
save("editorconfig", svg(32,32,
    bg_rect(),
    rect(5, 4, 22, 24, rx=2, stroke=WHITE, sw=1),
    line(9, 12, 23, 12, stroke=WHITE, sw=2),
    line(9, 17, 20, 17, stroke=WHITE, sw=2),
    line(9, 22, 16, 22, stroke=WHITE, sw=2),
))

# Lock — padlock shape
save("lock", svg(32,32,
    bg_rect(),
    rect(9, 16, 14, 12, rx=2, fill=YELLOW, sw=0),
    path("M 11 16 L 11 12 Q 11 6 16 6 Q 21 6 21 12 L 21 16",
         stroke=YELLOW, sw=3, fill="none"),
    circle(16, 22, 2, fill=BG, sw=0),
))

# Editorconfig done. Now ini:
save("ini", svg(32,32,
    bg_rect(),
    rect(4, 4, 24, 24, rx=2, stroke=PURPLE, sw=2),
    path("M 8 11 L 24 11", stroke=PURPLE, sw=2, fill="none"),
    path("M 8 18 L 24 18", stroke=PURPLE, sw=2, fill="none"),
    circle(8, 8, 2, fill=PURPLE, sw=0),
    circle(24, 8, 2, fill=PURPLE, sw=0),
    text(8, 16, "[sec]", fill=PURPLE, size=5, anchor="start"),
))

# ── Shader Files ──

# GLSL — gradient triangle  
save("glsl", svg(32,32,
    bg_rect(),
    poly([(16,4),(28,26),(4,26)], fill=BLUE, sw=0),
    poly([(16,4),(22,26),(4,26)], fill=CYAN, op=0.6, sw=0),
    poly([(16,4),(28,26),(22,26)], fill=MAGENTA, op=0.6, sw=0),
))

# HLSL — slanted gradient diamond
save("hlsl", svg(32,32,
    bg_rect(),
    poly([(16,4),(28,16),(16,28),(4,16)], fill=ORANGE, sw=0),
    poly([(16,4),(22,10),(22,22),(16,28)], fill=RED, op=0.7, sw=0),
))

# WGSL — W waveform
save("wgsl", svg(32,32,
    bg_rect(),
    path("M 4 8 L 8 24 L 12 12 L 16 24 L 20 12 L 24 24 L 28 8",
         stroke=GREEN, sw=3),
))

# SPV — spiral binary
save("spv", svg(32,32,
    bg_rect(),
    path("M 16 6 Q 22 6 22 12 Q 22 18 16 18 Q 10 18 10 24 Q 10 28 16 28",
         stroke=ORANGE, sw=3),
    circle(16, 6, 2, fill=ORANGE, sw=0),
    circle(16, 28, 2, fill=ORANGE, sw=0),
    text(14, 15, "01", fill=ORANGE, size=4, weight="normal", anchor="start"),
))

# ── Media ──

# Audio — waveform bars
save("audio", svg(32,32,
    bg_rect(),
    rect(4, 12, 3, 8, fill=BLUE, sw=0),
    rect(9, 8, 3, 16, fill=BLUE, sw=0),
    rect(14, 10, 3, 12, fill=CYAN, sw=0),
    rect(19, 5, 3, 22, fill=BLUE, sw=0),
    rect(24, 9, 3, 14, fill=CYAN, sw=0),
))

# Video — clapperboard
save("video", svg(32,32,
    bg_rect(),
    rect(4, 10, 24, 18, rx=2, fill=PURPLE, sw=0),
    poly([(13,14),(22,19),(13,24)], fill=WHITE, sw=0),
    rect(4, 6, 24, 6, fill=WHITE, sw=0),
    # Clapper lines
    line(8, 6, 11, 12, stroke=BG, sw=2),
    line(14, 6, 17, 12, stroke=BG, sw=2),
    line(20, 6, 23, 12, stroke=BG, sw=2),
))

# Image — frame with sun and hills
save("image", svg(32,32,
    bg_rect(),
    rect(3, 3, 26, 26, rx=2, stroke=MAGENTA, sw=2),
    circle(9, 9, 3, fill=YELLOW, sw=0),
    poly([(3,26),(10,18),(15,22),(22,14),(29,20),(29,29),(3,29)],
         fill=MAGENTA, op=0.5, sw=0),
    path("M 10 18 L 15 22 L 22 14", stroke=MAGENTA, sw=1, fill="none"),
))

# Font — typography A
save("font", svg(32,32,
    bg_rect(),
    path("M 8 26 L 16 6 L 24 26 M 11 20 L 21 20", stroke=ORANGE, sw=3),
    line(4, 28, 28, 28, stroke=ORANGE, sw=1),
))

# ── Archive ──

# Archive — box with down arrow
save("archive", svg(32,32,
    bg_rect(),
    rect(6, 12, 20, 16, rx=2, stroke=YELLOW, sw=2),
    rect(4, 8, 24, 6, rx=2, stroke=YELLOW, sw=2),
    line(16, 18, 16, 24, stroke=YELLOW, sw=2),
    poly([(11,22),(21,22),(16,28)], fill=YELLOW, sw=0),
))

# Zip — zipper track
save("zip", svg(32,32,
    bg_rect(),
    rect(11, 3, 10, 26, fill="#111111", stroke=YELLOW, sw=1),
    rect(13, 5, 6, 2, fill=YELLOW, sw=0),
    rect(13, 9, 6, 2, fill=YELLOW, sw=0),
    rect(13, 13, 6, 2, fill=YELLOW, sw=0),
    rect(13, 17, 6, 2, fill=YELLOW, sw=0),
    rect(13, 21, 6, 2, fill=YELLOW, sw=0),
    poly([(11,25),(16,29),(21,25)], fill=RED, sw=0),
))

# ── Databases ──

# Database — cylinder stack
save("database", svg(32,32,
    bg_rect(),
    path("M 6 10 A 10 4 0 0 1 26 10 A 10 4 0 0 1 6 10 Z", fill=BLUE, sw=0),
    rect(6, 10, 20, 12, fill=BLUE, sw=0),
    path("M 6 22 A 10 4 0 0 0 26 22", stroke=CYAN, sw=1, fill="none"),
    path("M 6 16 A 10 4 0 0 0 26 16", stroke=CYAN, sw=1, fill="none"),
    path("M 6 10 A 10 4 0 0 0 26 10", stroke=CYAN, sw=1, fill="none"),
    path("M 6 22 A 10 4 0 0 0 26 22 L 26 10", stroke=BLUE, sw=0, fill="none"),
    path("M 6 10 L 6 22 A 10 4 0 0 0 26 22 L 26 10", stroke=CYAN, sw=1, fill="none"),
))

# SQL — same cylinder but with SQL text
save("sql", svg(32,32,
    bg_rect(),
    path("M 6 8 A 10 4 0 0 1 26 8 A 10 4 0 0 1 6 8 Z", fill=MAGENTA, sw=0),
    rect(6, 8, 20, 16, fill=MAGENTA, sw=0),
    path("M 6 24 A 10 4 0 0 0 26 24", fill=MAGENTA, stroke=MAGENTA, sw=0),
    path("M 6 8 L 6 24 A 10 4 0 0 0 26 24 L 26 8", stroke=PURPLE, sw=1, fill="none"),
    text(16, 19, "SQL", fill=WHITE, size=6),
))

# ── Document formats ──

# PDF — document with red strip
save("pdf", svg(32,32,
    bg_rect(),
    path("M 6 2 L 6 30 L 26 30 L 26 8 L 20 2 Z", fill=WHITE, stroke=RED, sw=2),
    poly([(20,2),(20,8),(26,8)], fill=RED, sw=0),
    rect(6, 12, 20, 7, fill=RED, sw=0),
    text(16, 17, "PDF", fill=WHITE, size=5),
))

# TXT — plain text lines
save("txt", svg(32,32,
    bg_rect(),
    line(6, 8, 26, 8, stroke=WHITE, sw=2),
    line(6, 13, 24, 13, stroke=WHITE, sw=2),
    line(6, 18, 26, 18, stroke=WHITE, sw=2),
    line(6, 23, 21, 23, stroke=WHITE, sw=2),
))

# Log — terminal log output
save("log", svg(32,32,
    bg_rect(),
    rect(3, 3, 26, 26, rx=2, fill="#001400", stroke=GREEN, sw=1),
    text(5, 11, "[INFO]", fill=GREEN, size=4, anchor="start"),
    text(5, 17, "[WARN]", fill=YELLOW, size=4, anchor="start"),
    text(5, 23, "[ERR]", fill=RED, size=4, anchor="start"),
    circle(27, 5, 1.5, fill=GREEN, sw=0),
))

# Markdown — M ↓ symbol
save("markdown", svg(32,32,
    bg_rect(),
    path("M 4 26 L 4 8 L 11 18 L 18 8 L 18 26", stroke=BLUE, sw=3),
    path("M 24 10 L 24 22 M 20 18 L 24 22 L 28 18", stroke=BLUE, sw=2, fill="none"),
))

# ── Platform / Binaries ──

# EXE — Windows grid
save("exe", svg(32,32,
    bg_rect(),
    circle(16, 16, 12, fill=BLUE, sw=0),
    rect(9, 9, 6, 6, fill=WHITE, sw=0),
    rect(17, 9, 6, 6, fill=WHITE, sw=0),
    rect(9, 17, 6, 6, fill=WHITE, sw=0),
    rect(17, 17, 6, 6, fill=WHITE, sw=0),
))

# DMG — Apple shape
save("dmg", svg(32,32,
    bg_rect(),
    path("M 16 6 Q 14 3 12 5 Q 9 7 11 10 Q 9 10 9 13 Q 9 22 16 28 Q 23 22 23 13 Q 23 10 21 10 Q 23 7 20 5 Q 18 3 16 6 Z",
         fill=WHITE, sw=0),
    circle(20, 6, 2, fill=WHITE, sw=0),
))

# App — rounded square with orb
save("app", svg(32,32,
    bg_rect(),
    rect(4, 4, 24, 24, rx=8, fill=CYAN, sw=0),
    circle(16, 16, 7, fill=WHITE, op=0.3, sw=0),
    circle(16, 16, 3, fill=WHITE, sw=0),
))

# DEB — Debian swirl
save("deb", svg(32,32,
    bg_rect(),
    path("M 16 5 Q 22 5 22 10 Q 22 15 16 16 Q 10 17 10 22 Q 10 27 16 28",
         stroke=RED, sw=3, fill="none"),
    circle(16, 16, 2, fill=RED, sw=0),
))

# DLL — linked modules
save("dll", svg(32,32,
    bg_rect(),
    rect(4, 8, 10, 16, rx=2, stroke=PURPLE, sw=2),
    rect(18, 8, 10, 16, rx=2, stroke=PURPLE, sw=2),
    line(14, 16, 18, 16, stroke=PURPLE, sw=2),
    circle(14, 16, 2, fill=CYAN, sw=0),
    circle(18, 16, 2, fill=CYAN, sw=0),
))

# INK — ink drop / pen
save("ink", svg(32,32,
    bg_rect(),
    path("M 16 4 L 14 8 L 16 12 L 18 8 Z", fill=MAGENTA, sw=0),
    path("M 16 12 Q 13 15 13 20 L 13 26 Q 13 29 16 29 Q 19 29 19 26 L 19 20 Q 19 15 16 12 Z",
         fill=MAGENTA, sw=0),
))

# UASSET — Unreal logo-ish
save("uasset", svg(32,32,
    bg_rect(),
    circle(16, 16, 12, fill=ORANGE, sw=0),
    path("M 16 7 L 12 18 L 16 16 L 20 18 Z", fill=WHITE, sw=0),
    path("M 12 18 L 16 26 L 20 18", stroke=WHITE, sw=2, fill="none"),
))

# UPROJECT — Unreal project
save("uproject", svg(32,32,
    bg_rect(),
    rect(4, 4, 24, 24, rx=4, fill=RED, sw=0),
    path("M 16 9 L 11 18 L 16 15 L 21 18 Z", fill=WHITE, sw=0),
    path("M 11 18 L 16 24 L 21 18", stroke=WHITE, sw=2, fill="none"),
    circle(16, 16, 9, stroke=WHITE, op=0.3, sw=1),
))

# Model3D — wireframe cube
save("model3d", svg(32,32,
    bg_rect(),
    path("M 16 4 L 28 10 L 28 22 L 16 28 L 4 22 L 4 10 Z", stroke=PURPLE, sw=2),
    path("M 16 4 L 16 28", stroke=PURPLE, sw=1),
    path("M 4 10 L 16 16 L 28 10", stroke=PURPLE, sw=1),
    circle(16, 4, 2, fill=PURPLE, sw=0),
    circle(28, 10, 2, fill=PURPLE, sw=0),
    circle(28, 22, 2, fill=PURPLE, sw=0),
    circle(16, 28, 2, fill=PURPLE, sw=0),
    circle(4, 22, 2, fill=PURPLE, sw=0),
    circle(4, 10, 2, fill=PURPLE, sw=0),
))

# ── Special ──

# Kain — universal compiler nexus
save("kain", svg(32,32,
    bg_rect(),
    circle(16, 16, 6, fill=PURPLE, sw=0),
    circle(16, 16, 3, fill=MAGENTA, sw=0),
    # Rays to target platforms
    circle(16, 4, 2, fill=CYAN, sw=0),
    circle(26, 9, 2, fill=GREEN, sw=0),
    circle(28, 16, 2, fill=YELLOW, sw=0),
    circle(26, 23, 2, fill=RED, sw=0),
    circle(16, 28, 2, fill=PURPLE, sw=0),
    circle(6, 23, 2, fill=MAGENTA, sw=0),
    circle(4, 16, 2, fill=BLUE, sw=0),
    circle(6, 9, 2, fill=ORANGE, sw=0),
    line(16, 10, 16, 6, stroke=CYAN, sw=1),
    line(20, 12, 26, 9, stroke=GREEN, sw=1),
    line(22, 16, 28, 16, stroke=YELLOW, sw=1),
    line(20, 20, 26, 23, stroke=RED, sw=1),
    line(16, 22, 16, 28, stroke=PURPLE, sw=1),
    line(12, 20, 6, 23, stroke=MAGENTA, sw=1),
    line(10, 16, 4, 16, stroke=BLUE, sw=1),
    line(12, 12, 6, 9, stroke=ORANGE, sw=1),
    text(16, 20, "K", fill=WHITE, size=10),
))

# Zentako logo — stylized Z in pentagon
save("zentako-logo-128", svg(32,32,
    bg_rect(),
    poly([(16,3),(29,10),(26,25),(6,25),(3,10)], stroke=GREEN, sw=2),
    path("M 8 21 L 24 21 L 8 11 L 24 11", stroke=YELLOW, sw=3),
))

# ── Misc ──
save("gradle", svg(32,32, bg_rect(),
    path("M 16 6 Q 22 6 24 12 Q 26 18 22 23 Q 18 28 12 26 Q 6 24 6 18 Q 6 12 12 8 Q 14 6 16 6",
         fill=CYAN, sw=0),
    circle(13, 14, 2, fill=WHITE, sw=0),
    circle(19, 14, 2, fill=WHITE, sw=0),
    path("M 6 20 Q 4 24 6 26", stroke=CYAN, sw=3, fill="none"),
))

save("npm", svg(32,32, bg_rect(),
    rect(4, 10, 24, 13, fill=RED, sw=0),
    rect(8, 14, 5, 5, fill=WHITE, sw=0),
    rect(17, 14, 5, 5, fill=WHITE, sw=0),
))

print(f"\nDONE! All vintage terminal icons written to: {OUT}")
print(f"   {len(list(OUT.glob('*.svg')))} SVG files generated")
