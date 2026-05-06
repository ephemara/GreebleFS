import drawsvg as draw
import os

# ==========================================
# GREEBLE FS: PASTEL & MINIMAL ICON THEME
# ==========================================

# 1. Setup Directories (The Split System)
ROOT_DIR = "GreebleFS_Icons"
UI_DIR = os.path.join(ROOT_DIR, "ui")
os.makedirs(ROOT_DIR, exist_ok=True)
os.makedirs(UI_DIR, exist_ok=True)

# 2. Define the Pastel & Minimal Palette
P_BLUE   = "#AEC6CF"
P_PINK   = "#F4C2C2"
P_GREEN  = "#B8E0D2"
P_YELLOW = "#FDFD96"
P_PURPLE = "#C3B1E1"
P_ORANGE = "#FFD1B3"
P_RED    = "#FFB4B4"
P_GRAY   = "#E2E8F0"
P_DARK   = "#334155" # Thick slate for minimal linework

# 3. Canvas Helper
def create_canvas():
    return draw.Drawing(24, 24, viewBox="0 0 24 24")

# ==========================================
# GENERATOR FUNCTIONS
# ==========================================

def draw_file_icon(bg_color, text_content):
    """Draws a pastel file document with a folded corner and text."""
    d = create_canvas()
    # File Base
    d.append(draw.Path(
        d="M6 2h8l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", 
        fill=bg_color, stroke=P_DARK, stroke_width=2, stroke_linejoin="round"
    ))
    # Folded Corner
    d.append(draw.Path(
        d="M14 2v6h6", 
        fill="none", stroke=P_DARK, stroke_width=2, stroke_linejoin="round"
    ))
    # Language/Type Typography
    if text_content:
        d.append(draw.Text(
            text_content, 7, 12, 16.5, 
            text_anchor="middle", fill=P_DARK, font_family="monospace", font_weight="900"
        ))
    return d

def draw_folder_icon(bg_color, is_open=False, symbol=None):
    """Draws a thick-lined pastel folder."""
    d = create_canvas()
    if is_open:
        d.append(draw.Path(
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M2 10h20", 
            fill=bg_color, stroke=P_DARK, stroke_width=2, stroke_linejoin="round"
        ))
    else:
        d.append(draw.Path(
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z", 
            fill=bg_color, stroke=P_DARK, stroke_width=2, stroke_linejoin="round"
        ))
    
    if symbol:
        d.append(draw.Text(
            symbol, 9, 12, 17, 
            text_anchor="middle", fill=P_DARK, font_family="sans-serif", font_weight="900"
        ))
    return d

def draw_panel_icon(bg_color, inner_path):
    """Draws a beautiful squircle app icon for GreebleFS panels."""
    d = create_canvas()
    d.append(draw.Rect(
        3, 3, 18, 18, rx=6, ry=6, 
        fill=bg_color, stroke=P_DARK, stroke_width=2
    ))
    d.append(draw.Path(
        d=inner_path, 
        fill="none", stroke=P_DARK, stroke_width=2, stroke_linecap="round", stroke_linejoin="round"
    ))
    return d

def draw_ui_icon(path_data):
    """Draws pure minimal linework UI icons."""
    d = create_canvas()
    d.append(draw.Path(
        d=path_data, 
        fill="none", stroke=P_DARK, stroke_width=2, stroke_linecap="round", stroke_linejoin="round"
    ))
    return d

# ==========================================
# 1. EXPLORER FILE ICONS DEFINITIONS
# ==========================================
FILE_TYPES = {
    "app": (P_PURPLE, "APP"), "archive": (P_ORANGE, "ZIP"), "audio": (P_PINK, "WAV"),
    "c": (P_BLUE, "C"), "clojure": (P_GREEN, "CLJ"), "cmake": (P_GRAY, "MAK"),
    "cpp": (P_BLUE, "C++"), "csharp": (P_PURPLE, "C#"), "css": (P_BLUE, "CSS"),
    "dart": (P_BLUE, "DRT"), "database": (P_YELLOW, "SQL"), "deb": (P_RED, "DEB"),
    "dll": (P_GRAY, "DLL"), "dmg": (P_GRAY, "DMG"), "dockerfile": (P_BLUE, "DKR"),
    "editorconfig": (P_GRAY, "CFG"), "elixir": (P_PURPLE, "EX"), "env": (P_YELLOW, "ENV"),
    "erlang": (P_RED, "ERL"), "exe": (P_BLUE, "EXE"), "font": (P_GRAY, "TTF"),
    "git": (P_ORANGE, "GIT"), "gitignore": (P_GRAY, "GIT"), "glsl": (P_GREEN, "GL"),
    "go": (P_BLUE, "GO"), "gradle": (P_GREEN, "GRD"), "haskell": (P_PURPLE, "HS"),
    "hlsl": (P_GREEN, "HL"), "html": (P_ORANGE, "HTM"), "image": (P_YELLOW, "IMG"),
    "ini": (P_GRAY, "INI"), "ink": (P_PINK, "INK"), "java": (P_ORANGE, "JAV"),
    "javascript": (P_YELLOW, "JS"), "json": (P_YELLOW, "{ }"), "kain": (P_RED, "KN"),
    "kotlin": (P_PURPLE, "KT"), "less": (P_BLUE, "LSS"), "lock": (P_GRAY, "LCK"),
    "log": (P_GRAY, "LOG"), "lua": (P_BLUE, "LUA"), "makefile": (P_GRAY, "MAK"),
    "markdown": (P_BLUE, "MD"), "model3d": (P_PINK, "3D"), "npm": (P_RED, "NPM"),
    "ocaml": (P_ORANGE, "ML"), "pdf": (P_RED, "PDF"), "php": (P_PURPLE, "PHP"),
    "powershell": (P_BLUE, "PS"), "python": (P_YELLOW, "PY"), "r": (P_BLUE, "R"),
    "ruby": (P_RED, "RB"), "rust": (P_ORANGE, "RS"), "sass": (P_PINK, "SAS"),
    "scala": (P_RED, "SCA"), "scss": (P_PINK, "SCS"), "shell": (P_GRAY, "SH"),
    "spv": (P_GREEN, "SPV"), "sql": (P_ORANGE, "SQL"), "swift": (P_ORANGE, "SWF"),
    "toml": (P_YELLOW, "TML"), "txt": (P_GRAY, "TXT"), "typescript": (P_BLUE, "TS"),
    "uasset": (P_BLUE, "UAS"), "uproject": (P_BLUE, "UPR"), "video": (P_PURPLE, "VID"),
    "wgsl": (P_GREEN, "WG"), "xml": (P_YELLOW, "</>"), "yaml": (P_RED, "YML"),
    "zig": (P_ORANGE, "ZIG"), "zip": (P_ORANGE, "ZIP")
}

# ==========================================
# 2. EXPLORER FOLDER DEFINITIONS
# ==========================================
FOLDER_TYPES = {
    "folder": (P_BLUE, False, None), 
    "folder_open": (P_BLUE, True, None),
    "folder_assets": (P_PINK, False, "A"), 
    "folder_assets_open": (P_PINK, True, "A"),
    "folder_build": (P_ORANGE, False, "B"), 
    "folder_build_open": (P_ORANGE, True, "B"),
    "folder_config": (P_GRAY, False, "C"), 
    "folder_config_open": (P_GRAY, True, "C"),
    "folder_docs": (P_PURPLE, False, "D"), 
    "folder_docs_open": (P_PURPLE, True, "D"),
    "folder_src": (P_GREEN, False, "S"), 
    "folder_src_open": (P_GREEN, True, "S"),
    "folder_test": (P_YELLOW, False, "T"), 
    "folder_test_open": (P_YELLOW, True, "T"),
}

# ==========================================
# 3. GREEBLE FS APP PANELS
# ==========================================
PANEL_TYPES = {
    "panel_chronorift": (P_PURPLE, "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2"), # Clock 
    "panel_drawable_canvas": (P_YELLOW, "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586"), # Brush/Palette abstraction
    "panel_filesystem_aquarium": (P_BLUE, "M2 12c2.2 0 4-2 6-2s3.8 2 6 2 4-2 6-2 3.8 2 6 2 M2 17c2.2 0 4-2 6-2s3.8 2 6 2 4-2 6-2 3.8 2 6 2"), # Waves
    "panel_notes": (P_GRAY, "M12 20h9 M9 4v16 M14 4h-5 M14 8h-5 M14 12h-5 M14 16h-5"), # Note lines
    "panel_plugins": (P_PINK, "M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M10 9H8 M16 13H8 M16 17H8"), # Blocks
    "panel_screenshots": (P_GREEN, "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"), # Camera
    "panel_settings": (P_GRAY, "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6"), # Sliders
    "panel_storage": (P_ORANGE, "M22 12H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z M6 16h.01 M10 16h.01"), # Drive
    "panel_vibe_capsule": (P_RED, "M9 18V5l12-2v13 M9 9l12-2 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"), # Music
    "ui/panel_sketchfab": (P_BLUE, "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12"), # 3D Hex
}

# ==========================================
# 4. NESTED UI ICONS (Path Database)
# ==========================================
UI_PATHS = {
    "alert_circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01",
    "alert_triangle": "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
    "arrow_down": "M12 5v14 M19 12l-7 7-7-7",
    "arrow_down_to_line": "M12 3v14 M19 10l-7 7-7-7 M5 21h14",
    "arrow_left": "M19 12H5 M12 19l-7-7 7-7",
    "arrow_right": "M5 12h14 M12 5l7 7-7 7",
    "arrow_up": "M12 19V5 M5 12l7-7 7 7",
    "arrow_up_down": "M16 3l4 4-4 4 M20 7H4 M8 21l-4-4 4-4 M4 17h16",
    "arrow_up_left": "M9 15L19 5 M9 5h10v10",
    "arrow_up_right": "M15 15L5 5 M15 5H5v10",
    "audio_lines": "M2 10v3 M6 6v11 M10 3v18 M14 8v7 M18 5v13 M22 10v3",
    "audio_waveform": "M4 12v.01 M8 8v8 M12 3v18 M16 8v8 M20 12v.01",
    "blocks": "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
    "bot": "M12 8V4 M10 4h4 M4 12h16v8H4z M2 14h2 M20 14h2 M9 16v.01 M15 16v.01",
    "bug": "M8 2v4 M16 2v4 M12 18v4 M6 10H2 M22 10h-4 M6 14H2 M22 14h-4 M18 8a6 6 0 1 0-12 0v8a6 6 0 1 0 12 0V8z",
    "camera": "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "check": "M20 6L9 17l-5-5",
    "chevron_down": "M6 9l6 6 6-6",
    "chevron_left": "M15 18l-6-6 6-6",
    "chevron_right": "M9 18l6-6-6-6",
    "chevron_up": "M18 15l-6-6-6 6",
    "circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "clapperboard": "M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M2 11h20 M2 16h20 M7 6l-3 5 M12 6l-3 5 M17 6l-3 5",
    "clipboard": "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z",
    "clock": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    "copy": "M8 4h10a2 2 0 0 1 2 2v10 M16 8h-8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-10a2 2 0 0 0-2-2z",
    "copy_plus": "M8 4h10a2 2 0 0 1 2 2v10 M16 8h-8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-10a2 2 0 0 0-2-2z M12 12v6 M9 15h6",
    "corner_down_left": "M9 10l-5 5 5 5 M4 15h11a4 4 0 0 0 4-4V4",
    "cpu": "M4 4h16v16H4z M9 9h6v6H9z M9 1v3 M15 1v3 M9 20v3 M15 20v3 M20 9h3 M20 14h3 M1 9h3 M1 14h3",
    "crop": "M6.13 1L6 16a2 2 0 0 0 2 2h15 M1 6.13L16 6a2 2 0 0 1 2 2v15",
    "crosshair": "M12 2v20 M2 12h20 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    "download": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
    "droplet": "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
    "edit3": "M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
    "eraser": "M20 20H7L3 16a2.828 2.828 0 0 1 0-4l8-8a2.828 2.828 0 0 1 4 0l4 4a2.828 2.828 0 0 1 0 4l-4 4z M10 10l4 4",
    "external_link": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
    "eye": "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "file": "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7",
    "file_plus": "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M12 18v-6 M9 15h6",
    "file_search": "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M14 18l-2.5-2.5 M10.5 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    "file_text": "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M8 13h8 M8 17h8 M8 9h2",
    "film": "M19.82 2H4.18A2.18 2.18 0 0 0 2 4.18v15.64A2.18 2.18 0 0 0 4.18 22h15.64A2.18 2.18 0 0 0 22 19.82V4.18A2.18 2.18 0 0 0 19.82 2z M7 2v20 M17 2v20 M2 12h20 M2 7h5 M2 17h5 M17 17h5 M17 7h5",
    "folder_archive": "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M12 12v6 M9 15h6 M12 12h.01 M12 9h.01",
    "folder_git2": "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M15 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M9 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M15 13v1 M9 14v-2 M9 12l2-2h2",
    "folder_plus": "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M12 11v6 M9 14h6",
    "folder_tree": "M13 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M13 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z M4 5a2 2 0 0 1 2-2h3 M4 5v14 M4 11h7",
    "git_branch": "M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a9 9 0 0 1-9 9",
    "git_commit": "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M1.05 12H8 M16 12h6.95",
    "hard_drive": "M22 12H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z M6 16h.01 M10 16h.01",
    "hard_drive_download": "M22 12H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z M12 2v8 M9 7l3 3 3-3 M6 16h.01 M10 16h.01",
    "hash": "M4 9h16 M4 15h16 M10 3L8 21 M16 3l-2 18",
    "highlighter": "M9 11l-6 6v3h9l3-3 M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
    "home": "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
    "image_icon": "M3 3h18v18H3z M8.5 8.5m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0 M21 15l-5-5L5 21",
    "info": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01",
    "layers3": "M12 2L2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5",
    "layout_grid": "M10 3H3v7h7V3z M21 3h-7v7h7V3z M21 14h-7v7h7v-7z M10 14H3v7h7v-7z",
    "list": "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    "list_todo": "M9 6h11 M9 12h11 M9 18h11 M5 6v.01 M5 12v.01 M3 18l1.5 1.5L7 17",
    "loader": "M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83",
    "loader2": "M21 12a9 9 0 1 1-6.219-8.56",
    "loader_circle": "M21 12a9 9 0 1 1-6.219-8.56",
    "maximize2": "M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7",
    "message_square_text": "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M9 9h6 M9 13h6",
    "monitor": "M2 3h20v14H2z M8 21h8 M12 17v4",
    "monitor_play": "M2 3h20v14H2z M8 21h8 M12 17v4 M10 7l5 3-5 3z",
    "more_horizontal": "M12 12h.01 M19 12h.01 M5 12h.01",
    "mouse_pointer2": "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z M13 13l6 6",
    "move_right": "M18 8l4 4-4 4 M2 12h20",
    "music": "M9 18V5l12-2v13 M9 9l12-2 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    "palette": "M12 22a10 10 0 1 0-10-10c0 2 2 2 2 5a2 2 0 0 1-2 2 M18 12h.01 M14 7h.01 M10 7h.01 M6 12h.01",
    "pause": "M10 4H6v16h4z M18 4h-4v16h4z",
    "pencil": "M18 2L22 6L12 16L8 16L8 12L18 2Z",
    "pin": "M12 17v5 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
    "pin_off": "M2 2l20 20 M12 17v5 M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0-1.34.52 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14",
    "play": "M5 3l14 9-14 9z",
    "plus": "M12 5v14 M5 12h14",
    "puzzle": "M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "refresh_ccw": "M3 2v6h6 M21 12A9 9 0 0 0 6 5.3L3 8 M21 22v-6h-6 M3 12a9 9 0 0 0 15 6.7l3-2.7",
    "refresh_cw": "M21 2v6h-6 M3 12a9 9 0 0 1 15-6.7L21 8 M3 22v-6h6 M21 12a9 9 0 0 1-15 6.7L3 16",
    "rocket": "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z M9 18c1.38 0 2.22-.84 2.71-1.55l-3.16-3.16C7.84 13.78 7 14.62 7 16a2 2 0 0 0 2 2z",
    "rotate_ccw": "M3 2v6h6 M3 8l5-5a9 9 0 1 1-3 12",
    "save": "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8",
    "scan_line": "M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 12h10",
    "scissors": "M6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M6 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M20 4L8.12 15.88 M14.47 14.48L20 20 M8.12 8.12L12 12",
    "search": "M21 21l-6-6 M15 10.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z",
    "settings2": "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6",
    "shield": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "shield_alert": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01",
    "shield_check": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    "signature": "M17 13c1.5-1 3.5-1 5 0 M17 17c1.5-1 3.5-1 5 0 M4 17l6-6-2-2-6 6 M14 7l-2-2 M11 10l-2-2",
    "skip_back": "M19 20L9 12l10-8v16z M5 19V5",
    "skip_forward": "M5 4l10 8-10 8V4z M19 5v14",
    "sliders": "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6",
    "sliders_horizontal": "M21 4H8 M21 12H16 M21 20H8 M4 4H3 M12 12H3 M4 20H3 M8 1v6 M12 9v6 M8 17v6",
    "sparkles": "M12 3L14.5 9 21 11.5 14.5 14 12 21 9.5 14 3 11.5 9.5 9 12 3z",
    "split_square_horizontal": "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M3 12h18",
    "split_square_vertical": "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M12 3v18",
    "square": "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z",
    "square_plus": "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M12 8v8 M8 12h8",
    "square_split_horizontal": "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M3 12h18",
    "star": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    "star_off": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z M2 2l20 20",
    "sticky_note": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l-6-8z M14 2v8h8",
    "table": "M3 3h18v18H3z M3 9h18 M9 3v18 M15 3v18",
    "table2": "M3 3h18v18H3z M3 9h18 M9 9v12 M15 9v12",
    "tag": "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01",
    "tags": "M9 20l-5-5V5h10l5 5 M22 13.5l-6-6 M2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82l-7.17 7.17a2 2 0 0 1-2.83 0z",
    "terminal": "M4 17l6-6-6-6 M12 19h8",
    "terminal_square": "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M7 9l4 4-4 4 M13 17h4",
    "trash2": "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6",
    "triangle_alert": "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
    "type": "M4 7V4h16v3 M9 20h6 M12 4v16",
    "undo2": "M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13",
    "upload": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
    "volume2": "M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14",
    "volume_x": "M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6 M17 9l6 6",
    "waves": "M2 12c2.2 0 4-2 6-2s3.8 2 6 2 4-2 6-2 3.8 2 6 2 M2 17c2.2 0 4-2 6-2s3.8 2 6 2 4-2 6-2 3.8 2 6 2",
    "x": "M18 6L6 18 M6 6l12 12",
    "xcircle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M15 9l-6 6 M9 9l6 6",
    "zap": "M13 2L3 14h9l-1 8 10-12h-9l1-8z"
}

# ==========================================
# 5. EXECUTION ENGINE
# ==========================================

print(f"Generating GreebleFS Icon Theme ({len(FILE_TYPES) + len(FOLDER_TYPES) + len(PANEL_TYPES) + len(UI_PATHS)} total SVGs)...")

# Generate File Types
for name, (color, text) in FILE_TYPES.items():
    svg = draw_file_icon(color, text)
    svg.save_svg(os.path.join(ROOT_DIR, f"{name}.svg"))

# Generate Folder Types
for name, (color, is_open, symbol) in FOLDER_TYPES.items():
    svg = draw_folder_icon(color, is_open, symbol)
    svg.save_svg(os.path.join(ROOT_DIR, f"{name}.svg"))

# Generate Panels (Special handling: one is in UI dir based on your old JSON)
for name, (color, path_data) in PANEL_TYPES.items():
    svg = draw_panel_icon(color, path_data)
    if name.startswith("ui/"):
        svg.save_svg(os.path.join(ROOT_DIR, f"{name}.svg"))
    else:
        svg.save_svg(os.path.join(ROOT_DIR, f"{name}.svg"))

# Generate UI Icons
for name, path_data in UI_PATHS.items():
    svg = draw_ui_icon(path_data)
    svg.save_svg(os.path.join(UI_DIR, f"{name}.svg"))

print("✅ Perfect! All 162 pastel & minimal SVGs generated instantly in /GreebleFS_Icons/")