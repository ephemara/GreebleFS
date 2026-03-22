import os
import re
import colorsys
import shutil

INPUT_DIR = r"m:\OverlayTerm\public\icons"
OUTPUT_DIR = r"m:\OverlayTerm\output\vintage"

def hex_to_rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = h[0]*2 + h[1]*2 + h[2]*2
    if len(h) == 8: # Handle RGBA
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)), int(h[6:8], 16)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)), 255

def rgb_to_hex(r, g, b, a=255):
    if a == 255:
        return f"#{int(r):02X}{int(g):02X}{int(b):02X}"
    return f"#{int(r):02X}{int(g):02X}{int(b):02X}{int(a):02X}"

def make_vintage_color(hex_val):
    if hex_val.lower() == 'none': return 'none'
    try:
        rgb, a = hex_to_rgb(hex_val)
        r, g, b = rgb
        
        # Hardcode transformations for white and black for better vintage feel
        if hex_val.lower() in ('#ffffff', '#fff', 'white'):
            return '#F0DEC1' # Warm vintage paper color
        if hex_val.lower() in ('#000000', '#000', 'black'):
            return '#4A3C31' # Dark sepia ink
            
        h, s, v = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
        
        # Vintage effect:
        # 1. Desaturate colors significantly
        s *= 0.45
        
        # 2. Flatten contrast (lower brights, raise darks slightly, but mostly just make it murky)
        if v > 0.8: v = 0.8
        
        r_f, g_f, b_f = colorsys.hsv_to_rgb(h, s, v)
        
        # 3. Blend heavily with a warm, faded sepia
        sr, sg, sb = 220/255.0, 190/255.0, 150/255.0
        blend = 0.45
        r_f = r_f * (1 - blend) + sr * blend
        g_f = g_f * (1 - blend) + sg * blend
        b_f = b_f * (1 - blend) + sb * blend
        
        return rgb_to_hex(r_f*255, g_f*255, b_f*255, a)
    except Exception as e:
        return hex_val

def process_svg_content(content):
    # Replace explicit white and black
    content = re.sub(r'\bwhite\b', '#F0DEC1', content)
    content = re.sub(r'\bblack\b', '#4A3C31', content)
    
    # Replace hex colors
    def color_replacer(match):
        return make_vintage_color(match.group(0))
        
    content = re.sub(r'#[0-9a-fA-F]{3,8}\b', color_replacer, content)
    
    # We might also have rgb/rgba, but the generator usually outputs hex.
    
    # Optionally, we could add a subtle noise filter, but SVGs are vector.
    # To enhance the "vintage" theme, we can inject a subtle drop shadow or line styling,
    # but color palette transformation is usually the most effective approach for icons.
    
    return content

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    count = 0
    
    if not os.path.exists(INPUT_DIR):
        print(f"Input directory does not exist: {INPUT_DIR}")
        return
        
    for fname in os.listdir(INPUT_DIR):
        if fname.endswith('.svg'):
            in_path = os.path.join(INPUT_DIR, fname)
            out_path = os.path.join(OUTPUT_DIR, fname)
            
            with open(in_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            vintage_content = process_svg_content(content)
            
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(vintage_content)
                
            count += 1
            
    print(f"Successfully generated {count} vintage icons in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
