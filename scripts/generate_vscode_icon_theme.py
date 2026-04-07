#!/usr/bin/env python3
"""
VS Code Icon Theme Generator - CREATIVE EDITION 🎨
Each language gets its own UNIQUE, RECOGNIZABLE icon!
"""

import json
import os
from pathlib import Path
from typing import Dict, List


class VSCodeIconThemeGenerator:
    """Generates a VS Code icon theme with UNIQUE icons for every file type."""
    
    def __init__(self, output_dir: str = "vscode-icon-theme"):
        self.output_dir = Path(output_dir)
        self.icons_dir = self.output_dir / "icons"
        self.icons_dir.mkdir(parents=True, exist_ok=True)
        self.taxonomy = self._load_taxonomy()
        
        # Color palette
        self.colors = {
            "rust": "#CE422B", "python": "#3776AB", "javascript": "#F7DF1E",
            "typescript": "#3178C6", "cpp": "#00599C", "c": "#A8B9CC",
            "csharp": "#239120", "java": "#007396", "go": "#00ADD8",
            "ruby": "#CC342D", "php": "#777BB4", "swift": "#FA7343",
            "kotlin": "#7F52FF", "dart": "#0175C2", "lua": "#2C2D72",
            "zig": "#F7A41D", "elixir": "#4B275F", "haskell": "#5D4F85",
            "r": "#276DC3", "scala": "#DC322F", "clojure": "#5881D8",
            "erlang": "#A90533", "ocaml": "#EC6813",
            "html": "#E34C26", "css": "#1572B6", "scss": "#CC6699",
            "sass": "#CC6699", "less": "#1D365D",
            "json": "#F59E0B", "yaml": "#CB171E", "toml": "#9C4121",
            "xml": "#0060AC", "markdown": "#083FA1",
            "glsl": "#5586A4", "hlsl": "#5586A4", "wgsl": "#5586A4",
            "spv": "#5586A4", "shader": "#5586A4",
            "kain": "#8B5CF6",
            "dockerfile": "#2496ED", "makefile": "#6D00CC",
            "git": "#F05032", "gitignore": "#F05032",
            "env": "#EAB308", "editorconfig": "#6B7280",
            "lock": "#F59E0B",
            "database": "#2563EB", "sql": "#2563EB",
            "model3d": "#8B5CF6",
            "shell": "#4ADE80", "powershell": "#012456",
            "exe": "#0078D4", "dmg": "#1E293B", "app": "#1E293B", "deb": "#A80030",
            "dll": "#5C6BC0", "ini": "#9C27B0", "ink": "#E91E63",
            "uasset": "#FF9800", "uproject": "#FF5722",
            "audio": "#3B82F6", "font": "#E67E22", "archive": "#F39C12",
            "cmake": "#064F8C", "gradle": "#02303A", "npm": "#CB3837",
            "pdf": "#F40F02", "txt": "#6B6B6B",
            "log": "#6B6B6B", "image": "#FF6B6B", "video": "#9B59B6",
            "zip": "#F39C12", "folder": "#90A4AE", "folder_open": "#90A4AE",
            "folder_src": "#42A5F5", "folder_test": "#66BB6A",
            "folder_docs": "#FFA726", "folder_config": "#AB47BC",
            "folder_build": "#8D6E63", "folder_assets": "#EC407A",
            "folder_components": "#26A69A", "folder_packages": "#5C6BC0",
            "folder_plugins": "#8E24AA", "folder_database": "#1E88E5",
            "folder_api": "#EF5350", "folder_scripts": "#8BC34A",
            "folder_public": "#29B6F6", "folder_engine": "#FF7043",
            "folder_ai": "#7E57C2",
            "default": "#6B6B6B",
        }

    def _load_taxonomy(self) -> Dict[str, Dict[str, List[str]]]:
        taxonomy_path = Path(__file__).resolve().parent / "icon-data" / "icon_taxonomy.json"
        if not taxonomy_path.exists():
            return {"vscode_folder_associations": {}}
        return json.loads(taxonomy_path.read_text(encoding="utf-8"))
    
    # ============================================================================
    # CUSTOM LANGUAGE ICONS - Each language gets its own unique design!
    # ============================================================================
    
    def _generate_rust_svg(self, color: str) -> str:
        """Rust - The Crab! 🦀"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="18" rx="8" ry="6" fill="{color}"/>
  <circle cx="13" cy="16" r="1.5" fill="white"/>
  <circle cx="19" cy="16" r="1.5" fill="white"/>
  <circle cx="13" cy="16" r="0.8" fill="#000"/>
  <circle cx="19" cy="16" r="0.8" fill="#000"/>
  <path d="M8 14 L6 12 L5 13 L7 15 Z" fill="{color}"/>
  <path d="M24 14 L26 12 L27 13 L25 15 Z" fill="{color}"/>
  <path d="M10 20 L7 23" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M11 21 L9 25" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 22 L11 26" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M22 20 L25 23" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M21 21 L23 25" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M20 22 L21 26" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="18" r="3" fill="none" stroke="white" stroke-width="1"/>
  <circle cx="16" cy="18" r="1" fill="white"/>
</svg>'''
    
    def _generate_python_svg(self, color: str) -> str:
        """Python - The Snake! 🐍"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 8 Q8 12 10 16 Q12 20 10 24" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M22 8 Q24 12 22 16 Q20 20 22 24" stroke="#FFD43B" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="10" cy="8" r="3" fill="{color}"/>
  <circle cx="22" cy="8" r="3" fill="#FFD43B"/>
  <circle cx="9" cy="7" r="0.8" fill="white"/>
  <circle cx="23" cy="7" r="0.8" fill="white"/>
  <path d="M10 10 L9 12 M10 10 L11 12" stroke="{color}" stroke-width="0.5"/>
</svg>'''
    
    def _generate_javascript_svg(self, color: str) -> str:
        """JavaScript - JS with lightning bolt"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="24" height="24" rx="3" fill="{color}"/>
  <text x="16" y="21" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#000" text-anchor="middle">JS</text>
  <path d="M24 8 L20 16 L23 16 L19 24 L23 16 L20 16 Z" fill="#000" opacity="0.3"/>
</svg>'''
    
    def _generate_typescript_svg(self, color: str) -> str:
        """TypeScript - TS with shield (type safety)"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 L26 8 L26 16 Q26 24 16 28 Q6 24 6 16 L6 8 Z" fill="{color}"/>
  <text x="16" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">TS</text>
</svg>'''
    
    def _generate_cpp_svg(self, color: str) -> str:
        """C++ - Hexagon with ++"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" fill="{color}"/>
  <text x="16" y="20" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">C++</text>
  <path d="M22 12 L22 16 M20 14 L24 14" stroke="white" stroke-width="1.5" opacity="0.5"/>
  <path d="M26 12 L26 16 M24 14 L28 14" stroke="white" stroke-width="1.5" opacity="0.5"/>
</svg>'''
    
    def _generate_c_svg(self, color: str) -> str:
        """C - Simple C in circle"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="12" fill="{color}"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">C</text>
</svg>'''
    
    def _generate_go_svg(self, color: str) -> str:
        """Go - Gopher mascot"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="20" rx="9" ry="7" fill="{color}"/>
  <circle cx="16" cy="14" r="6" fill="{color}"/>
  <ellipse cx="11" cy="10" rx="2" ry="3" fill="{color}"/>
  <ellipse cx="21" cy="10" rx="2" ry="3" fill="{color}"/>
  <circle cx="13" cy="14" r="1.5" fill="white"/>
  <circle cx="19" cy="14" r="1.5" fill="white"/>
  <circle cx="13" cy="14" r="0.8" fill="#000"/>
  <circle cx="19" cy="14" r="0.8" fill="#000"/>
  <circle cx="16" cy="16" r="1" fill="#000"/>
  <rect x="14" y="17" width="1.5" height="2" fill="white"/>
  <rect x="16.5" y="17" width="1.5" height="2" fill="white"/>
</svg>'''
    
    def _generate_ruby_svg(self, color: str) -> str:
        """Ruby - Gem/Diamond"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 L26 12 L16 28 L6 12 Z" fill="{color}"/>
  <path d="M16 4 L16 28" stroke="white" stroke-width="1" opacity="0.3"/>
  <path d="M6 12 L26 12" stroke="white" stroke-width="1" opacity="0.3"/>
  <path d="M10 8 L16 28" stroke="white" stroke-width="1" opacity="0.2"/>
  <path d="M22 8 L16 28" stroke="white" stroke-width="1" opacity="0.2"/>
  <circle cx="13" cy="10" r="2" fill="white" opacity="0.6"/>
</svg>'''
    
    def _generate_java_svg(self, color: str) -> str:
        """Java - Coffee cup ☕"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 12 L8 24 Q8 26 10 26 L22 26 Q24 26 24 24 L24 12 Z" fill="{color}"/>
  <rect x="8" y="10" width="16" height="3" fill="{color}"/>
  <path d="M24 14 Q28 14 28 18 Q28 22 24 22" stroke="{color}" stroke-width="2" fill="none"/>
  <path d="M12 6 Q11 8 12 10" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M16 4 Q15 6 16 8" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M20 6 Q19 8 20 10" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>'''
    
    def _generate_php_svg(self, color: str) -> str:
        """PHP - Elephant 🐘"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="18" cy="18" rx="8" ry="6" fill="{color}"/>
  <circle cx="12" cy="14" r="5" fill="{color}"/>
  <path d="M10 16 Q8 18 8 20 Q8 22 10 22" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="14" cy="12" rx="3" ry="4" fill="{color}" opacity="0.7"/>
  <circle cx="11" cy="13" r="1" fill="white"/>
  <path d="M26 18 Q28 16 28 20" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>'''
    
    def _generate_swift_svg(self, color: str) -> str:
        """Swift - Bird in flight 🐦"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="16" rx="6" ry="4" fill="{color}"/>
  <path d="M10 16 Q4 12 6 8" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M22 16 Q28 12 26 8" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M16 18 L16 24" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="14" r="2.5" fill="{color}"/>
  <circle cx="17" cy="14" r="0.8" fill="white"/>
  <path d="M8 20 L4 20" stroke="{color}" stroke-width="1" opacity="0.5"/>
  <path d="M10 22 L6 22" stroke="{color}" stroke-width="1" opacity="0.5"/>
</svg>'''
    
    def _generate_html_svg(self, color: str) -> str:
        """HTML - Angle brackets with 5"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 8 L6 16 L10 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 8 L26 16 L22 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 10 L20 10 L19 20 L16 21 L13 20 L12 10 Z" fill="{color}" opacity="0.3"/>
  <text x="16" y="19" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="{color}" text-anchor="middle">5</text>
</svg>'''
    
    def _generate_css_svg(self, color: str) -> str:
        """CSS - Paint palette 🎨"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 Q8 6 6 14 Q6 22 14 24 Q22 24 24 16 Q24 8 16 6 Z" fill="{color}"/>
  <circle cx="20" cy="20" r="2" fill="white"/>
  <circle cx="12" cy="12" r="2" fill="#FF6B6B"/>
  <circle cx="16" cy="10" r="2" fill="#4ECDC4"/>
  <circle cx="20" cy="12" r="2" fill="#FFE66D"/>
  <circle cx="12" cy="18" r="2" fill="#95E1D3"/>
  <text x="16" y="28" font-family="Arial, sans-serif" font-size="6" font-weight="bold" fill="{color}" text-anchor="middle">CSS3</text>
</svg>'''
    
    def _generate_json_svg(self, color: str) -> str:
        """JSON - Curly braces"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 6 Q8 6 8 10 L8 14 Q8 16 6 16 Q8 16 8 18 L8 22 Q8 26 12 26" stroke="{color}" stroke-width="2" fill="none"/>
  <path d="M20 6 Q24 6 24 10 L24 14 Q24 16 26 16 Q24 16 24 18 L24 22 Q24 26 20 26" stroke="{color}" stroke-width="2" fill="none"/>
  <text x="16" y="14" font-family="monospace" font-size="5" fill="{color}" text-anchor="middle">"key":</text>
  <text x="16" y="20" font-family="monospace" font-size="5" fill="{color}" text-anchor="middle">"val"</text>
</svg>'''
    
    def _generate_markdown_svg(self, color: str) -> str:
        """Markdown - M with down arrow"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 24 L6 8 L12 16 L18 8 L18 24" stroke="{color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 10 L24 20 M20 16 L24 20 L28 16" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8" y1="26" x2="16" y2="26" stroke="{color}" stroke-width="1" opacity="0.3"/>
  <line x1="8" y1="28" x2="14" y2="28" stroke="{color}" stroke-width="1" opacity="0.3"/>
</svg>'''
    
    def _generate_glsl_svg(self, color: str) -> str:
        """GLSL/Shader - Gradient triangle"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{color};stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FF6B6B;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4ECDC4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <path d="M16 6 L28 26 L4 26 Z" fill="url(#shaderGrad)"/>
  <path d="M8 22 L16 10 L24 22" stroke="white" stroke-width="1" opacity="0.3" fill="none"/>
  <path d="M12 24 L16 16 L20 24" stroke="white" stroke-width="1" opacity="0.3" fill="none"/>
</svg>'''
    
    def _generate_hlsl_svg(self, color: str) -> str:
        """HLSL - Same as GLSL"""
        return self._generate_glsl_svg(color)
    
    def _generate_wgsl_svg(self, color: str) -> str:
        """WGSL - WebGPU W"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 8 L8 24 L12 12 L16 24 L20 12 L24 24 L28 8" stroke="{color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="10" y="14" width="12" height="8" rx="1" fill="{color}" opacity="0.3"/>
  <circle cx="13" cy="17" r="0.5" fill="{color}"/>
  <circle cx="16" cy="17" r="0.5" fill="{color}"/>
  <circle cx="19" cy="17" r="0.5" fill="{color}"/>
</svg>'''
    
    def _generate_spv_svg(self, color: str) -> str:
        """SPV/SPIRV - Binary spiral"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 8 Q20 8 20 12 Q20 16 16 16 Q12 16 12 20 Q12 24 16 24" stroke="{color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="16" cy="8" r="1.5" fill="{color}"/>
  <circle cx="16" cy="24" r="1.5" fill="{color}"/>
  <text x="16" y="18" font-family="monospace" font-size="5" fill="{color}" text-anchor="middle">01</text>
</svg>'''
    
    def _generate_dockerfile_svg(self, color: str) -> str:
        """Docker - Whale with containers 🐋"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="20" rx="10" ry="6" fill="{color}"/>
  <rect x="10" y="14" width="3" height="4" fill="{color}" opacity="0.8"/>
  <rect x="14" y="14" width="3" height="4" fill="{color}" opacity="0.8"/>
  <rect x="18" y="14" width="3" height="4" fill="{color}" opacity="0.8"/>
  <path d="M26 18 Q30 16 28 20 Q30 24 26 22" fill="{color}"/>
  <path d="M4 24 Q8 26 12 24 Q16 22 20 24 Q24 26 28 24" stroke="{color}" stroke-width="1.5" fill="none" opacity="0.5"/>
</svg>'''
    
    def _generate_git_svg(self, color: str) -> str:
        """Git - Branch diagram"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="8" y1="8" x2="8" y2="24" stroke="{color}" stroke-width="2"/>
  <path d="M8 12 Q12 12 16 16 L16 20" stroke="{color}" stroke-width="2" fill="none"/>
  <circle cx="8" cy="8" r="2.5" fill="{color}"/>
  <circle cx="8" cy="16" r="2.5" fill="{color}"/>
  <circle cx="8" cy="24" r="2.5" fill="{color}"/>
  <circle cx="16" cy="20" r="2.5" fill="{color}"/>
  <path d="M16 20 Q12 22 8 24" stroke="{color}" stroke-width="1.5" fill="none" stroke-dasharray="2,2"/>
</svg>'''
    
    def _generate_yaml_svg(self, color: str) -> str:
        """YAML - Indented structure"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="6" y1="8" x2="14" y2="8" stroke="{color}" stroke-width="2"/>
  <line x1="10" y1="12" x2="18" y2="12" stroke="{color}" stroke-width="2"/>
  <line x1="10" y1="16" x2="18" y2="16" stroke="{color}" stroke-width="2"/>
  <line x1="6" y1="20" x2="14" y2="20" stroke="{color}" stroke-width="2"/>
  <line x1="10" y1="24" x2="18" y2="24" stroke="{color}" stroke-width="2"/>
  <circle cx="16" cy="8" r="1" fill="{color}"/>
  <circle cx="20" cy="12" r="1" fill="{color}"/>
  <circle cx="20" cy="16" r="1" fill="{color}"/>
  <circle cx="16" cy="20" r="1" fill="{color}"/>
  <line x1="22" y1="12" x2="26" y2="12" stroke="{color}" stroke-width="1.5" opacity="0.5"/>
  <line x1="22" y1="16" x2="26" y2="16" stroke="{color}" stroke-width="1.5" opacity="0.5"/>
</svg>'''
    
    def _generate_toml_svg(self, color: str) -> str:
        """TOML - Table structure"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="8" width="20" height="16" rx="2" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="6" y1="14" x2="26" y2="14" stroke="{color}" stroke-width="2"/>
  <line x1="16" y1="8" x2="16" y2="24" stroke="{color}" stroke-width="2"/>
  <text x="11" y="12" font-family="monospace" font-size="4" fill="{color}" text-anchor="middle">key</text>
  <text x="21" y="12" font-family="monospace" font-size="4" fill="{color}" text-anchor="middle">val</text>
</svg>'''
    
    def _generate_xml_svg(self, color: str) -> str:
        """XML - Nested tags"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 8 L4 16 L8 24" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M24 8 L28 16 L24 24" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M12 12 L10 16 L12 20" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M20 12 L22 16 L20 20" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="2" fill="{color}"/>
</svg>'''
    
    def _generate_pdf_svg(self, color: str) -> str:
        """PDF - Document with red banner"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2 L8 30 L24 30 L24 8 L18 2 Z" fill="white" stroke="{color}" stroke-width="2"/>
  <path d="M18 2 L18 8 L24 8" fill="{color}"/>
  <rect x="8" y="12" width="16" height="6" fill="{color}"/>
  <text x="16" y="17" font-family="Arial, sans-serif" font-size="5" font-weight="bold" fill="white" text-anchor="middle">PDF</text>
</svg>'''
    
    def _generate_txt_svg(self, color: str) -> str:
        """TXT - Simple lines"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="8" y1="8" x2="24" y2="8" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <line x1="8" y1="12" x2="22" y2="12" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <line x1="8" y1="16" x2="24" y2="16" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <line x1="8" y1="20" x2="20" y2="20" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <line x1="8" y1="24" x2="18" y2="24" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>'''
    
    def _generate_log_svg(self, color: str) -> str:
        """LOG - Terminal style"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="24" height="24" rx="2" fill="#000" stroke="{color}" stroke-width="1"/>
  <text x="6" y="12" font-family="monospace" font-size="4" fill="#0F0">[INFO]</text>
  <text x="6" y="17" font-family="monospace" font-size="4" fill="#FF0">[WARN]</text>
  <text x="6" y="22" font-family="monospace" font-size="4" fill="#F00">[ERROR]</text>
  <circle cx="26" cy="6" r="1" fill="#0F0"/>
</svg>'''
    
    def _generate_image_svg(self, color: str) -> str:
        """Image - Picture frame with mountain"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="24" height="24" rx="2" stroke="{color}" stroke-width="2" fill="none"/>
  <circle cx="10" cy="10" r="2" fill="#FFD43B"/>
  <path d="M4 24 L12 16 L16 20 L24 12 L28 16 L28 28 L4 28 Z" fill="{color}" opacity="0.3"/>
  <path d="M12 16 L16 20 L24 12" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _generate_video_svg(self, color: str) -> str:
        """Video - Play button"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="8" width="24" height="16" rx="2" fill="{color}"/>
  <path d="M14 12 L22 16 L14 20 Z" fill="white"/>
  <circle cx="26" cy="10" r="1.5" fill="#F00"/>
</svg>'''
    
    def _generate_zip_svg(self, color: str) -> str:
        """ZIP - Zipper"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="4" width="8" height="24" fill="{color}" opacity="0.3"/>
  <rect x="14" y="6" width="4" height="2" fill="{color}"/>
  <rect x="14" y="10" width="4" height="2" fill="{color}"/>
  <rect x="14" y="14" width="4" height="2" fill="{color}"/>
  <rect x="14" y="18" width="4" height="2" fill="{color}"/>
  <rect x="14" y="22" width="4" height="2" fill="{color}"/>
  <path d="M16 24 L14 28 L18 28 Z" fill="{color}"/>
</svg>'''
    
    def _generate_makefile_svg(self, color: str) -> str:
        """Makefile - Build hammer"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="18" width="8" height="10" fill="{color}"/>
  <path d="M12 18 L12 8 L20 8 L20 12 L24 12 L24 16 L20 16 L20 18" fill="{color}"/>
  <circle cx="22" cy="10" r="1.5" fill="white"/>
</svg>'''
    
    def _generate_kain_svg(self, color: str) -> str:
        """KAIN - Universal Compiler Nexus ⚡🔮"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="kainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#EC4899;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" />
    </linearGradient>
    <radialGradient id="kainGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0" />
    </radialGradient>
  </defs>
  
  <!-- Central nexus core -->
  <circle cx="16" cy="16" r="6" fill="url(#kainGrad)"/>
  <circle cx="16" cy="16" r="4" fill="url(#kainGlow)"/>
  
  <!-- Compilation target nodes (8 directions) -->
  <circle cx="16" cy="4" r="2" fill="#3B82F6"/>   <!-- WASM -->
  <circle cx="26" cy="8" r="2" fill="#10B981"/>   <!-- Rust -->
  <circle cx="28" cy="16" r="2" fill="#F59E0B"/>  <!-- GPU -->
  <circle cx="26" cy="24" r="2" fill="#EF4444"/>  <!-- UE5 -->
  <circle cx="16" cy="28" r="2" fill="#8B5CF6"/>  <!-- Native -->
  <circle cx="6" cy="24" r="2" fill="#EC4899"/>   <!-- JS/TS -->
  <circle cx="4" cy="16" r="2" fill="#06B6D4"/>   <!-- C/C++ -->
  <circle cx="6" cy="8" r="2" fill="#F97316"/>    <!-- Python -->
  
  <!-- Connection rays (universal compilation) -->
  <line x1="16" y1="10" x2="16" y2="4" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="12" x2="26" y2="8" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="22" y1="16" x2="28" y2="16" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="20" x2="26" y2="24" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="16" y1="22" x2="16" y2="28" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="12" y1="20" x2="6" y2="24" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="10" y1="16" x2="4" y2="16" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  <line x1="12" y1="12" x2="6" y2="8" stroke="url(#kainGrad)" stroke-width="1.5" opacity="0.6"/>
  
  <!-- K letter in center -->
  <text x="16" y="20" font-family="Arial, sans-serif" font-size="10" font-weight="bold" 
        fill="white" text-anchor="middle">K</text>
</svg>'''
    
    # ============================================================================
    # FOLDER ICONS
    # ============================================================================
    
    def _generate_file_svg(self, name: str, color: str) -> str:
        """FALLBACK - This should NEVER be used! Every file type gets custom icon!"""
        # If we hit this, we're missing a custom icon - make it OBVIOUS
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="12" fill="#FF0000" opacity="0.2"/>
  <text x="16" y="20" font-family="Arial, sans-serif" font-size="8" font-weight="bold" 
        fill="#FF0000" text-anchor="middle">MISSING</text>
  <text x="16" y="28" font-family="Arial, sans-serif" font-size="5" 
        fill="#FF0000" text-anchor="middle">{name}</text>
</svg>'''
    
    def _folder_badge_svg(self, name: str) -> str:
        badge_map = {
            "folder_src": '<path d="M12 15 L9 18 L12 21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 15 L23 18 L20 21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 13 L15 23" stroke="white" stroke-width="2" stroke-linecap="round"/>',
            "folder_components": '<rect x="10" y="13" width="5" height="5" rx="1.2" fill="white"/><rect x="17" y="13" width="5" height="5" rx="1.2" fill="white"/><rect x="10" y="20" width="5" height="5" rx="1.2" fill="white"/><rect x="17" y="20" width="5" height="5" rx="1.2" fill="white"/>',
            "folder_docs": '<rect x="11" y="12" width="10" height="13" rx="1.5" fill="white"/><line x1="13" y1="16" x2="19" y2="16" stroke="#0F172A" stroke-width="1.4"/><line x1="13" y1="19" x2="19" y2="19" stroke="#0F172A" stroke-width="1.4"/>',
            "folder_config": '<line x1="11" y1="15" x2="21" y2="15" stroke="white" stroke-width="2"/><line x1="11" y1="21" x2="21" y2="21" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="2" fill="white"/><circle cx="18" cy="21" r="2" fill="white"/>',
            "folder_build": '<path d="M12 22 L17 12 L20 15 L15 25 Z" fill="white"/><rect x="18" y="11" width="4" height="8" rx="1.2" fill="white"/>',
            "folder_assets": '<rect x="10" y="13" width="12" height="10" rx="1.5" fill="white"/><circle cx="14" cy="16" r="1.5" fill="#0F172A"/><path d="M12 21 L16 18 L19 20 L22 17 L22 23 L10 23 Z" fill="#0F172A"/>',
            "folder_packages": '<rect x="11" y="14" width="10" height="9" rx="1.5" fill="white"/><path d="M11 14 L16 11 L21 14" stroke="white" stroke-width="1.6" fill="none"/>',
            "folder_plugins": '<rect x="11" y="14" width="8" height="7" rx="1.5" fill="white"/><line x1="14" y1="11" x2="14" y2="14" stroke="white" stroke-width="2"/><line x1="19" y1="17.5" x2="22" y2="17.5" stroke="white" stroke-width="2"/>',
            "folder_database": '<ellipse cx="16" cy="13.5" rx="5.5" ry="2.5" fill="white"/><path d="M10.5 13.5 V21 C10.5 22.4 13 23.5 16 23.5 C19 23.5 21.5 22.4 21.5 21 V13.5" fill="white"/>',
            "folder_api": '<circle cx="12" cy="18" r="2" fill="white"/><circle cx="20" cy="14" r="2" fill="white"/><circle cx="21" cy="22" r="2" fill="white"/><line x1="13.5" y1="17" x2="18.5" y2="15" stroke="white" stroke-width="1.8"/><line x1="13.5" y1="19" x2="19.5" y2="21" stroke="white" stroke-width="1.8"/>',
            "folder_scripts": '<path d="M10 15 L7 18 L10 21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 23 H20" stroke="white" stroke-width="2" stroke-linecap="round"/>',
            "folder_test": '<path d="M13 12 H19" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M14 12 V16 L11 22 A2 2 0 0 0 13 24 H19 A2 2 0 0 0 21 22 L18 16 V12" fill="white"/>',
            "folder_public": '<circle cx="16" cy="18" r="5" fill="none" stroke="white" stroke-width="2"/><line x1="11" y1="18" x2="21" y2="18" stroke="white" stroke-width="1.6"/><line x1="16" y1="13" x2="16" y2="23" stroke="white" stroke-width="1.6"/>',
            "folder_engine": '<circle cx="16" cy="18" r="4" fill="white"/><path d="M16 12 V10 M16 26 V24 M10 18 H8 M24 18 H22 M11.8 13.8 L10.3 12.3 M21.7 23.7 L20.2 22.2 M20.2 13.8 L21.7 12.3 M10.3 23.7 L11.8 22.2" stroke="white" stroke-width="2" stroke-linecap="round"/>',
            "folder_ai": '<path d="M16 11 L18 16 L23 16 L19 19 L21 24 L16 21 L11 24 L13 19 L9 16 L14 16 Z" fill="white"/>'
        }
        return badge_map.get(name, "")

    def _generate_folder_svg(self, color: str, name: str = "folder") -> str:
        """Closed folder icon"""
        badge = self._folder_badge_svg(name)
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 6C2 4.89543 2.89543 4 4 4H12L14 7H28C29.1046 7 30 7.89543 30 9V26C30 27.1046 29.1046 28 28 28H4C2.89543 28 2 27.1046 2 26V6Z" 
        fill="{color}" fill-opacity="0.2"/>
  <path d="M2 10C2 8.89543 2.89543 8 4 8H12L14 11H28C29.1046 11 30 11.8954 30 13V26C30 27.1046 29.1046 28 28 28H4C2.89543 28 2 27.1046 2 26V10Z" 
        fill="{color}"/>
  <path d="M2 10C2 8.89543 2.89543 8 4 8H12L14 11H28C29.1046 11 30 11.8954 30 13V26C30 27.1046 29.1046 28 28 28H4C2.89543 28 2 27.1046 2 26V10Z" 
        stroke="{color}" stroke-width="1.5" stroke-opacity="0.5"/>
  <rect x="8" y="11.5" width="16" height="15" rx="4" fill="white" fill-opacity="0.12"/>
  {badge}
</svg>'''
    
    def _generate_folder_open_svg(self, color: str, name: str = "folder_open") -> str:
        """Open folder icon"""
        badge = self._folder_badge_svg(name.replace("_open", ""))
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 6C2 4.89543 2.89543 4 4 4H12L14 7H28C29.1046 7 30 7.89543 30 9V12H2V6Z" fill="{color}"/>
  <path d="M1 12L3 26C3.16519 27.0489 4.05922 28 5.11803 28H26.882C27.9408 28 28.8348 27.0489 29 26L31 12H1Z" 
        fill="{color}" fill-opacity="0.7"/>
  <path d="M2 6C2 4.89543 2.89543 4 4 4H12L14 7H28C29.1046 7 30 7.89543 30 9V12M1 12L3 26C3.16519 27.0489 4.05922 28 5.11803 28H26.882C27.9408 28 28.8348 27.0489 29 26L31 12H1Z" 
        stroke="{color}" stroke-width="1.5" stroke-opacity="0.5"/>
  <rect x="8" y="11.5" width="16" height="14" rx="4" fill="white" fill-opacity="0.12"/>
  {badge}
</svg>'''
    
    # ============================================================================
    # MAIN GENERATION LOGIC
    # ============================================================================
    
    def generate_svg_icon(self, name: str, color: str, icon_type: str = "file") -> str:
        """Generate an SVG icon - checks for custom implementations first"""
        if icon_type == "folder":
            return self._generate_folder_svg(color, name)
        elif icon_type == "folder_open":
            return self._generate_folder_open_svg(color, name)
        else:
            # Check if we have a custom icon for this type
            custom_method = f"_generate_{name}_svg"
            if hasattr(self, custom_method):
                return getattr(self, custom_method)(color)
            return self._generate_file_svg(name, color)
    
    # ============================================================================
    # ALL CUSTOM ICON GENERATORS - INSIDE THE CLASS!
    # ============================================================================
    
    def _generate_scss_svg(self, color: str) -> str:
        """SCSS - Sass with curly braces"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <path d="M12 10 Q10 12 12 14 Q14 16 12 18" stroke="white" stroke-width="2" fill="none"/>
  <path d="M20 10 Q22 12 20 14 Q18 16 20 18" stroke="white" stroke-width="2" fill="none"/>
</svg>'''
    
    def _generate_sass_svg(self, color: str) -> str:
        """Sass - Sass logo"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <path d="M12 12 Q16 10 20 12 Q22 14 20 16 Q18 18 16 18 Q14 18 12 16 Q10 14 12 12" fill="white"/>
</svg>'''
    
    def _generate_less_svg(self, color: str) -> str:
        """Less - @ symbol"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" stroke="{color}" stroke-width="2" fill="none"/>
  <circle cx="16" cy="16" r="4" fill="{color}"/>
  <path d="M20 16 Q24 16 24 20 Q24 24 20 24 Q16 24 16 20" stroke="{color}" stroke-width="2" fill="none"/>
</svg>'''
    
    def _generate_csharp_svg(self, color: str) -> str:
        """C# - Musical sharp"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="20" height="20" rx="3" fill="{color}"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">C#</text>
</svg>'''
    
    def _generate_kotlin_svg(self, color: str) -> str:
        """Kotlin - K triangle"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 6 L26 6 L6 26 Z" fill="{color}"/>
  <path d="M6 6 L26 26 L6 26 Z" fill="{color}" opacity="0.7"/>
</svg>'''
    
    def _generate_dart_svg(self, color: str) -> str:
        """Dart - Diamond"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 8 L24 8 L24 24 L16 28 L8 24 Z" fill="{color}"/>
  <path d="M16 8 L24 16 L16 24 L8 16 Z" fill="white" opacity="0.3"/>
</svg>'''
    
    def _generate_lua_svg(self, color: str) -> str:
        """Lua - Moon"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <circle cx="20" cy="12" r="8" fill="#1E293B"/>
</svg>'''
    
    def _generate_zig_svg(self, color: str) -> str:
        """Zig - Lightning Z"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 8 L22 8 L14 16 L20 16 L8 26 L12 18 L8 18 Z" fill="{color}"/>
</svg>'''
    
    def _generate_elixir_svg(self, color: str) -> str:
        """Elixir - Potion drop"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 Q20 8 20 14 Q20 20 16 24 Q12 20 12 14 Q12 8 16 4 Z" fill="{color}"/>
  <circle cx="14" cy="12" r="2" fill="white" opacity="0.6"/>
</svg>'''
    
    def _generate_haskell_svg(self, color: str) -> str:
        """Haskell - Lambda"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 26 L14 16 L8 6" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 26 L20 16 L14 6" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="18" y1="16" x2="26" y2="16" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
</svg>'''
    
    def _generate_r_svg(self, color: str) -> str:
        """R - Statistical R"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="12" fill="{color}"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">R</text>
  <path d="M18 16 L24 24" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>'''
    
    def _generate_scala_svg(self, color: str) -> str:
        """Scala - Staircase"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="20" width="6" height="6" fill="{color}"/>
  <rect x="12" y="14" width="6" height="12" fill="{color}"/>
  <rect x="18" y="8" width="6" height="18" fill="{color}"/>
</svg>'''
    
    def _generate_clojure_svg(self, color: str) -> str:
        """Clojure - Parentheses"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <path d="M10 8 Q8 16 10 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M22 8 Q24 16 22 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="3" fill="white"/>
</svg>'''
    
    def _generate_erlang_svg(self, color: str) -> str:
        """Erlang - Atom"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="2" fill="{color}"/>
  <ellipse cx="16" cy="16" rx="12" ry="6" stroke="{color}" stroke-width="2" fill="none"/>
  <ellipse cx="16" cy="16" rx="6" ry="12" stroke="{color}" stroke-width="2" fill="none"/>
</svg>'''
    
    def _generate_ocaml_svg(self, color: str) -> str:
        """OCaml - Camel"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 20 L8 24 M12 20 L12 24 M20 20 L20 24 M24 20 L24 24" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 20 Q8 16 10 14 Q12 12 14 12 Q16 12 18 14 Q20 16 22 14 Q24 12 26 14 Q28 16 28 20" fill="{color}"/>
  <circle cx="10" cy="14" r="2" fill="{color}"/>
  <circle cx="22" cy="14" r="2" fill="{color}"/>
</svg>'''
    
    def _generate_exe_svg(self, color: str) -> str:
        """Windows EXE"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <rect x="10" y="10" width="5" height="5" fill="white" opacity="0.8"/>
  <rect x="17" y="10" width="5" height="5" fill="white" opacity="0.8"/>
  <rect x="10" y="17" width="5" height="5" fill="white" opacity="0.8"/>
  <rect x="17" y="17" width="5" height="5" fill="white" opacity="0.8"/>
</svg>'''
    
    def _generate_dmg_svg(self, color: str) -> str:
        """macOS DMG - Apple"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 Q14 4 12 6 Q10 8 12 10 Q10 10 10 12 Q10 20 16 26 Q22 20 22 12 Q22 10 20 10 Q22 8 20 6 Q18 4 16 6 Z" fill="{color}"/>
  <circle cx="18" cy="6" r="1.5" fill="{color}"/>
</svg>'''
    
    def _generate_app_svg(self, color: str) -> str:
        """macOS APP"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="20" height="20" rx="4" fill="{color}"/>
  <circle cx="16" cy="16" r="6" fill="white" opacity="0.3"/>
  <circle cx="16" cy="16" r="3" fill="white"/>
</svg>'''
    
    def _generate_deb_svg(self, color: str) -> str:
        """Debian package"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 Q20 6 20 10 Q20 14 16 16 Q12 18 12 22 Q12 26 16 28" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="2" fill="{color}"/>
</svg>'''
    
    def _generate_env_svg(self, color: str) -> str:
        """ENV file"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="24" height="24" rx="2" stroke="{color}" stroke-width="2" fill="none"/>
  <text x="8" y="14" font-family="monospace" font-size="5" fill="{color}">KEY=</text>
  <text x="8" y="20" font-family="monospace" font-size="5" fill="{color}">VAL</text>
  <circle cx="24" cy="8" r="2" fill="#F59E0B"/>
</svg>'''
    
    def _generate_gitignore_svg(self, color: str) -> str:
        """Gitignore"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <path d="M12 12 L20 20 M20 12 L12 20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>'''
    
    def _generate_editorconfig_svg(self, color: str) -> str:
        """EditorConfig"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="8" width="20" height="16" rx="2" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="10" y1="14" x2="22" y2="14" stroke="{color}" stroke-width="1.5"/>
  <line x1="10" y1="18" x2="18" y2="18" stroke="{color}" stroke-width="1.5"/>
</svg>'''
    
    def _generate_lock_svg(self, color: str) -> str:
        """Lock files"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="16" width="12" height="10" rx="2" fill="{color}"/>
  <path d="M12 16 L12 12 Q12 8 16 8 Q20 8 20 12 L20 16" stroke="{color}" stroke-width="2" fill="none"/>
  <circle cx="16" cy="21" r="1.5" fill="white"/>
</svg>'''
    
    def _generate_database_svg(self, color: str) -> str:
        """Database"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="10" rx="8" ry="3" fill="{color}"/>
  <rect x="8" y="10" width="16" height="12" fill="{color}"/>
  <ellipse cx="16" cy="22" rx="8" ry="3" fill="{color}"/>
  <ellipse cx="16" cy="16" rx="8" ry="3" fill="{color}" opacity="0.5"/>
</svg>'''
    
    def _generate_sql_svg(self, color: str) -> str:
        """SQL"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="12" rx="10" ry="4" fill="{color}"/>
  <rect x="6" y="12" width="20" height="10" fill="{color}"/>
  <ellipse cx="16" cy="22" rx="10" ry="4" fill="{color}"/>
  <text x="16" y="18" font-family="monospace" font-size="6" font-weight="bold" fill="white" text-anchor="middle">SQL</text>
</svg>'''
    
    def _generate_model3d_svg(self, color: str) -> str:
        """3D model - Wireframe cube"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 L26 12 L26 20 L16 26 L6 20 L6 12 Z" stroke="{color}" stroke-width="2" fill="none"/>
  <path d="M16 6 L16 26" stroke="{color}" stroke-width="2"/>
  <path d="M6 12 L16 18 L26 12" stroke="{color}" stroke-width="2"/>
  <circle cx="16" cy="6" r="1.5" fill="{color}"/>
  <circle cx="26" cy="12" r="1.5" fill="{color}"/>
  <circle cx="16" cy="26" r="1.5" fill="{color}"/>
  <circle cx="6" cy="12" r="1.5" fill="{color}"/>
</svg>'''
    
    def _generate_shell_svg(self, color: str) -> str:
        """Shell scripts"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="6" width="24" height="20" rx="2" fill="#000" stroke="{color}" stroke-width="2"/>
  <path d="M8 12 L12 16 L8 20" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="14" y1="20" x2="20" y2="20" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>'''
    
    def _generate_powershell_svg(self, color: str) -> str:
        """PowerShell"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="6" width="24" height="20" rx="2" fill="{color}"/>
  <path d="M8 12 L14 16 L8 20" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="16" y1="20" x2="24" y2="20" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <path d="M20 8 L18 14 L20 14 L18 20" stroke="#FFD700" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _generate_audio_svg(self, color: str) -> str:
        """Audio - Waveform"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="12" width="2" height="8" fill="{color}"/>
  <rect x="10" y="8" width="2" height="16" fill="{color}"/>
  <rect x="14" y="10" width="2" height="12" fill="{color}"/>
  <rect x="18" y="6" width="2" height="20" fill="{color}"/>
  <rect x="22" y="10" width="2" height="12" fill="{color}"/>
  <rect x="26" y="14" width="2" height="4" fill="{color}"/>
</svg>'''
    
    def _generate_font_svg(self, color: str) -> str:
        """Font - Typography"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="8" y="20" font-family="serif" font-size="14" font-weight="bold" fill="{color}">A</text>
  <text x="18" y="24" font-family="serif" font-size="10" fill="{color}">a</text>
  <line x1="6" y1="26" x2="28" y2="26" stroke="{color}" stroke-width="1.5"/>
</svg>'''
    
    def _generate_archive_svg(self, color: str) -> str:
        """Archive - Compression"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="10" width="16" height="16" rx="2" stroke="{color}" stroke-width="2" fill="none"/>
  <path d="M12 6 L12 10 M16 6 L16 10 M20 6 L20 10" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M16 16 L16 20 M14 18 L16 20 L18 18" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _generate_cmake_svg(self, color: str) -> str:
        """CMake"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 L26 26 L6 26 Z" fill="{color}"/>
  <path d="M16 6 L16 26" stroke="white" stroke-width="2" opacity="0.5"/>
</svg>'''
    
    def _generate_gradle_svg(self, color: str) -> str:
        """Gradle - Elephant"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 8 Q20 8 22 12 Q24 16 22 20 Q20 24 16 24 Q12 24 10 20 Q8 16 10 12 Q12 8 16 8" fill="{color}"/>
  <circle cx="14" cy="14" r="1.5" fill="white"/>
  <circle cx="18" cy="14" r="1.5" fill="white"/>
</svg>'''
    
    def _generate_npm_svg(self, color: str) -> str:
        """NPM"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="10" width="20" height="12" fill="{color}"/>
  <rect x="10" y="14" width="4" height="4" fill="white"/>
  <rect x="18" y="14" width="4" height="4" fill="white"/>
</svg>'''
    
    def _generate_dll_svg(self, color: str) -> str:
        """DLL - Dynamic Link Library"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="20" height="20" rx="2" fill="{color}"/>
  <path d="M10 12 L10 20 L14 20 Q16 20 16 18 Q16 16 14 16 L10 16" stroke="white" stroke-width="2" fill="none"/>
  <path d="M18 12 L18 20 M18 12 L22 12 M18 20 L22 20" stroke="white" stroke-width="2"/>
  <text x="16" y="28" font-family="monospace" font-size="5" font-weight="bold" 
        fill="{color}" text-anchor="middle">DLL</text>
</svg>'''
    
    def _generate_ini_svg(self, color: str) -> str:
        """INI - Configuration file"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="20" height="20" rx="2" stroke="{color}" stroke-width="2" fill="none"/>
  <text x="10" y="14" font-family="monospace" font-size="5" fill="{color}">[section]</text>
  <text x="10" y="19" font-family="monospace" font-size="4" fill="{color}">key=value</text>
  <circle cx="8" cy="8" r="2" fill="{color}"/>
  <circle cx="24" cy="8" r="2" fill="{color}"/>
</svg>'''
    
    def _generate_ink_svg(self, color: str) -> str:
        """INK - Inkle narrative scripting"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 L14 8 L16 12 L18 8 Z" fill="{color}"/>
  <path d="M16 12 Q14 14 14 18 L14 26 Q14 28 16 28 Q18 28 18 26 L18 18 Q18 14 16 12" fill="{color}"/>
  <circle cx="12" cy="16" r="1" fill="{color}" opacity="0.6"/>
  <circle cx="20" cy="16" r="1" fill="{color}" opacity="0.6"/>
  <circle cx="10" cy="20" r="1.5" fill="{color}" opacity="0.4"/>
  <circle cx="22" cy="20" r="1.5" fill="{color}" opacity="0.4"/>
</svg>'''
    
    def _generate_uasset_svg(self, color: str) -> str:
        """UASSET - Unreal Engine asset"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="10" fill="{color}"/>
  <path d="M16 8 L12 16 L16 14 L20 16 Z" fill="white"/>
  <path d="M12 16 L16 24 L20 16" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="16" y="30" font-family="Arial, sans-serif" font-size="4" font-weight="bold" 
        fill="{color}" text-anchor="middle">UASSET</text>
</svg>'''
    
    def _generate_uproject_svg(self, color: str) -> str:
        """UPROJECT - Unreal Engine project"""
        return f'''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="20" height="20" rx="3" fill="{color}"/>
  <path d="M16 10 L12 16 L16 14.5 L20 16 Z" fill="white"/>
  <path d="M12 16 L16 22 L20 16" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="16" r="8" stroke="white" stroke-width="1.5" fill="none" opacity="0.3"/>
  <text x="16" y="30" font-family="Arial, sans-serif" font-size="4" font-weight="bold" 
        fill="{color}" text-anchor="middle">UPROJECT</text>
</svg>'''
    
    def get_file_associations(self) -> Dict[str, List[str]]:
        """Return comprehensive file extension associations"""
        return {
            "rust": ["rs"], "python": ["py", "pyw", "pyx", "pyd", "pyi"],
            "javascript": ["js", "mjs", "cjs"], "typescript": ["ts", "tsx", "mts", "cts"],
            "cpp": ["cpp", "cc", "cxx", "c++", "hpp", "hh", "hxx", "h++"],
            "c": ["c", "h"], "csharp": ["cs", "csx"],
            "java": ["java", "class", "jar"], "go": ["go"],
            "ruby": ["rb", "rbw", "rake", "gemspec"],
            "php": ["php", "phtml", "php3", "php4", "php5", "phps"],
            "swift": ["swift"], "kotlin": ["kt", "kts"], "dart": ["dart"],
            "lua": ["lua"], "zig": ["zig"], "elixir": ["ex", "exs"], "haskell": ["hs", "lhs"],
            "r": ["r", "R", "rmd", "Rmd"], "scala": ["scala", "sc"], 
            "clojure": ["clj", "cljs", "cljc", "edn"], "erlang": ["erl", "hrl"], "ocaml": ["ml", "mli"],
            "html": ["html", "htm", "xhtml"],
            "css": ["css"], "scss": ["scss"], "sass": ["sass"], "less": ["less"],
            "json": ["json", "jsonc", "json5"],
            "yaml": ["yaml", "yml"], "toml": ["toml"],
            "xml": ["xml", "xsd", "xsl", "xslt"],
            "markdown": ["md", "markdown", "mdown", "mkd"],
            "glsl": ["glsl", "vert", "frag", "geom", "tesc", "tese", "comp"],
            "hlsl": ["hlsl", "fx", "fxh", "hlsli"],
            "wgsl": ["wgsl"], "spv": ["spv", "spirv"],
            "kain": ["kn", "kain"],
            "dockerfile": ["dockerfile", "dockerignore"],
            "makefile": ["makefile", "mk", "make"],
            "git": ["gitattributes", "gitmodules"],
            "gitignore": ["gitignore"],
            "env": ["env", "env.local", "env.development", "env.production", "env.test"],
            "editorconfig": ["editorconfig"],
            "lock": ["lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "Gemfile.lock", "poetry.lock"],
            "database": ["db", "sqlite", "sqlite3"],
            "sql": ["sql"],
            "model3d": ["obj", "fbx", "gltf", "glb", "blend", "stl", "dae", "3ds", "max"],
            "shell": ["sh", "bash", "zsh", "fish"],
            "powershell": ["ps1", "psm1", "psd1"],
            "exe": ["exe", "msi"],
            "dmg": ["dmg"],
            "app": ["app"],
            "deb": ["deb", "rpm"],
            "dll": ["dll"],
            "ini": ["ini", "cfg", "conf"],
            "ink": ["ink"],
            "uasset": ["uasset"],
            "uproject": ["uproject"],
            "pdf": ["pdf"], "txt": ["txt", "text"],
            "log": ["log"], "image": ["png", "jpg", "jpeg", "gif", "bmp", "webp", "ico"],
            "video": ["mp4", "avi", "mov", "mkv", "webm"],
            "audio": ["mp3", "wav", "flac", "ogg", "m4a", "aac", "wma"],
            "font": ["ttf", "otf", "woff", "woff2", "eot"],
            "zip": ["zip"], "archive": ["tar", "gz", "7z", "rar", "bz2", "xz"],
            "cmake": ["cmake", "cmake.in"], "gradle": ["gradle", "gradle.kts"],
            "npm": ["npmrc", "npmignore"],
        }
    
    def get_folder_associations(self) -> Dict[str, List[str]]:
        """Return folder name associations"""
        return self.taxonomy.get("vscode_folder_associations", {})
    
    def generate_theme(self, theme_name: str = "K_OS Icons"):
        """Generate the complete icon theme"""
        print(f"🎨 Generating VS Code Icon Theme: {theme_name}")
        
        # Generate file icons
        file_associations = self.get_file_associations()
        file_icon_definitions = {}
        file_extensions = {}
        file_names = {}
        
        for icon_name, extensions in file_associations.items():
            color = self.colors.get(icon_name, self.colors["default"])
            svg_content = self.generate_svg_icon(icon_name, color, "file")
            
            # Save SVG
            svg_path = self.icons_dir / f"{icon_name}.svg"
            svg_path.write_text(svg_content)
            
            # Add to theme definition
            file_icon_definitions[icon_name] = {"iconPath": f"./icons/{icon_name}.svg"}
            
            # Map extensions
            for ext in extensions:
                file_extensions[ext] = icon_name
                if icon_name in ["git", "dockerfile", "makefile"]:
                    file_names[ext] = icon_name
        
        print(f"✅ Generated {len(file_icon_definitions)} file icons")
        
        # Generate folder icons
        folder_associations = self.get_folder_associations()
        folder_icon_definitions = {}
        folder_names = {}
        folder_names_expanded = {}
        
        # Default folders
        for folder_type in ["folder", "folder_open"]:
            color = self.colors[folder_type]
            svg_content = self.generate_svg_icon(folder_type, color, folder_type)
            svg_path = self.icons_dir / f"{folder_type}.svg"
            svg_path.write_text(svg_content)
            folder_icon_definitions[folder_type] = {"iconPath": f"./icons/{folder_type}.svg"}
        
        # Special folders
        for folder_name, folder_list in folder_associations.items():
            color = self.colors.get(folder_name, self.colors["folder"])
            
            # Closed folder
            svg_content = self.generate_svg_icon(folder_name, color, "folder")
            svg_path = self.icons_dir / f"{folder_name}.svg"
            svg_path.write_text(svg_content)
            
            # Open folder
            svg_content_open = self.generate_svg_icon(folder_name, color, "folder_open")
            svg_path_open = self.icons_dir / f"{folder_name}_open.svg"
            svg_path_open.write_text(svg_content_open)
            
            folder_icon_definitions[folder_name] = {"iconPath": f"./icons/{folder_name}.svg"}
            folder_icon_definitions[f"{folder_name}_open"] = {"iconPath": f"./icons/{folder_name}_open.svg"}
            
            for fname in folder_list:
                folder_names[fname] = folder_name
                folder_names_expanded[fname] = f"{folder_name}_open"
        
        print(f"✅ Generated {len(folder_icon_definitions)} folder icons")
        
        # Generate theme JSON
        theme_json = {
            "name": theme_name,
            "version": "1.0.0",
            "author": "K_OS",
            "description": "Unique icon for every file type - Rust crabs, Python snakes, and more!",
            "iconDefinitions": {**file_icon_definitions, **folder_icon_definitions},
            "file": "default",
            "folder": "folder",
            "folderExpanded": "folder_open",
            "fileExtensions": file_extensions,
            "fileNames": file_names,
            "folderNames": folder_names,
            "folderNamesExpanded": folder_names_expanded,
        }
        
        # Save theme JSON
        theme_path = self.output_dir / "icon-theme.json"
        theme_path.write_text(json.dumps(theme_json, indent=2))
        print(f"✅ Theme JSON saved")
        
        # Generate package.json
        package_json = {
            "name": "k-os-icon-theme",
            "displayName": theme_name,
            "description": "Unique icon for every file type - Rust crabs, Python snakes, and more!",
            "version": "1.0.0",
            "publisher": "k-os",
            "engines": {"vscode": "^1.60.0"},
            "categories": ["Themes"],
            "contributes": {
                "iconThemes": [{
                    "id": "k-os-icons",
                    "label": theme_name,
                    "path": "./icon-theme.json"
                }]
            }
        }
        
        package_path = self.output_dir / "package.json"
        package_path.write_text(json.dumps(package_json, indent=2))
        print(f"✅ Package JSON saved")
        
        # Generate README
        readme_content = f"""# {theme_name}

🎨 A VS Code icon theme where EVERY language gets its own unique, recognizable icon!

## Features

- 🦀 **Rust** - Actual crab icon
- 🐍 **Python** - Intertwined snakes
- ⚡ **JavaScript** - JS with lightning bolt
- 🛡️ **TypeScript** - Shield for type safety
- ☕ **Java** - Coffee cup with steam
- 🐘 **PHP** - Elephant mascot
- 🐦 **Swift** - Bird in flight
- 💎 **Ruby** - Gem/diamond
- 🐹 **Go** - Gopher mascot
- 🎨 **CSS** - Paint palette
- 📝 **Markdown** - M with down arrow
- 🌈 **Shaders** - Gradient triangles
- 🐋 **Docker** - Whale with containers
- 🔀 **Git** - Branch diagram
- And many more unique designs!

## Installation

1. Copy this folder to your VS Code extensions directory:
   - **Windows**: `%USERPROFILE%\\.vscode\\extensions`
   - **macOS/Linux**: `~/.vscode/extensions`

2. Reload VS Code (Ctrl+Shift+P → "Reload Window")

3. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)

4. Type "File Icon Theme" and select "{theme_name}"

## Supported

- **{len(file_extensions)}+ file extensions**
- **{len(folder_names)} special folder types**
- All major programming languages
- Shaders (GLSL, HLSL, WGSL, SPIRV)
- Config files (JSON, YAML, TOML, XML)
- Media files (images, videos, archives)

## License

MIT - Made with 🔥 by K_OS
"""
        
        readme_path = self.output_dir / "README.md"
        readme_path.write_text(readme_content, encoding='utf-8')
        print(f"✅ README saved")
        
        print(f"\n🎉 COMPLETE! Theme generated at: {self.output_dir}")
        print(f"📊 Stats:")
        print(f"   - {len(file_icon_definitions)} unique file icons")
        print(f"   - {len(folder_icon_definitions)} folder variants")
        print(f"   - {len(file_extensions)} file extensions mapped")
        print(f"\n📦 To install:")
        print(f"   1. Copy '{self.output_dir.name}' to VS Code extensions folder")
        print(f"   2. Reload VS Code")
        print(f"   3. Select '{theme_name}' from File Icon Theme")


def main():
    """Main entry point"""
    generator = VSCodeIconThemeGenerator()
    generator.generate_theme("K_OS Icons")


if __name__ == "__main__":
    main()
