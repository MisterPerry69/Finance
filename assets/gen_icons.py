"""
Generate icon-192.png and icon-512.png for Tide app (lighthouse icon).
Pure Python, no external deps — uses only struct + zlib.
"""
import struct
import zlib
import os

def png_chunk(chunk_type, data):
    c = chunk_type + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

def write_png(path, width, height, pixels):
    """pixels: list of (R,G,B,A) tuples, row by row"""
    def make_scanline(row):
        line = bytearray()
        line.append(0)  # filter type None
        for r,g,b,a in row:
            line.extend([r,g,b,a])
        return bytes(line)
    raw = b"".join(make_scanline(pixels[y*width:(y+1)*width]) for y in range(height))
    compressed = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
        f.write(png_chunk(b"IDAT", compressed))
        f.write(png_chunk(b"IEND", b""))

def lerp(a, b, t):
    return int(a + (b - a) * t)

def rgba(r,g,b,a=255):
    return (r,g,b,a)

def blend(src, dst):
    """Alpha-composite src over dst"""
    sa = src[3] / 255.0
    da = dst[3] / 255.0
    out_a = sa + da * (1 - sa)
    if out_a == 0:
        return (0,0,0,0)
    def ch(s,d):
        return int((s * sa + d * da * (1 - sa)) / out_a)
    return (ch(src[0],dst[0]), ch(src[1],dst[1]), ch(src[2],dst[2]), int(out_a * 255))

# Palette
BG      = rgba(20, 60, 81)        # navy
TEAL    = rgba(37, 183, 187)      # teal
BEACON  = rgba(200, 53, 42)       # red
WHITE   = rgba(255, 255, 255)
GRAY    = rgba(200, 210, 215)
TRANS   = rgba(0, 0, 0, 0)

def draw_circle(pixels, w, h, cx, cy, r, color):
    for y in range(h):
        for x in range(w):
            if (x - cx)**2 + (y - cy)**2 <= r*r:
                pixels[y*w+x] = blend(color, pixels[y*w+x])

def draw_rect(pixels, w, h, x0, y0, x1, y1, color):
    for y in range(max(0,y0), min(h,y1)):
        for x in range(max(0,x0), min(w,x1)):
            pixels[y*w+x] = blend(color, pixels[y*w+x])

def draw_trapezoid(pixels, w, h, top_x0, top_x1, bot_x0, bot_x1, y0, y1, color):
    """Draw a trapezoid (lighthouse body)"""
    if y1 <= y0:
        return
    for y in range(max(0,y0), min(h,y1)):
        t = (y - y0) / (y1 - y0)
        lx = int(top_x0 + (bot_x0 - top_x0) * t)
        rx = int(top_x1 + (bot_x1 - top_x1) * t)
        for x in range(max(0,lx), min(w,rx)):
            pixels[y*w+x] = blend(color, pixels[y*w+x])

def render_lighthouse(size):
    """Render lighthouse icon at given size"""
    pixels = [BG] * (size * size)
    s = size / 192.0  # scale factor relative to 192px design

    cx = size // 2

    # Background circle (slightly lighter navy)
    draw_circle(pixels, size, size, cx, size//2, int(size*0.46), rgba(26, 74, 99))

    # --- Lantern room (top red cap) ---
    lamp_w  = int(36 * s)
    lamp_h  = int(20 * s)
    lamp_y0 = int(34 * s)
    lamp_y1 = lamp_y0 + lamp_h
    draw_rect(pixels, size, size,
              cx - lamp_w//2, lamp_y0,
              cx + lamp_w//2, lamp_y1,
              BEACON)

    # Lantern light glow (small white dot in lamp)
    draw_circle(pixels, size, size, cx, lamp_y0 + lamp_h//2, int(6*s), rgba(255,255,200,180))

    # White stripe on lamp
    stripe_h = int(5 * s)
    stripe_y = lamp_y0 + lamp_h//2 - stripe_h//2
    draw_rect(pixels, size, size,
              cx - lamp_w//2, stripe_y,
              cx + lamp_w//2, stripe_y + stripe_h,
              rgba(255,255,255,60))

    # --- Tower body (white trapezoid, narrowing toward top) ---
    tower_top_w  = int(34 * s)
    tower_bot_w  = int(52 * s)
    tower_y0     = lamp_y1
    tower_y1     = int(148 * s)

    draw_trapezoid(pixels, size, size,
                   cx - tower_top_w//2, cx + tower_top_w//2,
                   cx - tower_bot_w//2, cx + tower_bot_w//2,
                   tower_y0, tower_y1,
                   WHITE)

    # Red horizontal bands on tower (3 of them)
    band_count = 3
    tower_h = tower_y1 - tower_y0
    for i in range(band_count):
        band_y0 = tower_y0 + int(tower_h * (i+0.3) / band_count)
        band_y1 = band_y0 + max(2, int(7 * s))
        t0 = (band_y0 - tower_y0) / tower_h
        t1 = (band_y1 - tower_y0) / tower_h
        lx0 = cx - tower_top_w//2 + int((tower_bot_w - tower_top_w)//2 * t0)
        rx0 = cx + tower_top_w//2 + int((tower_bot_w - tower_top_w)//2 * t0)
        draw_rect(pixels, size, size, lx0, band_y0, rx0, band_y1, BEACON)

    # --- Base platform ---
    base_w  = int(70 * s)
    base_h  = int(14 * s)
    base_y0 = tower_y1
    base_y1 = base_y0 + base_h
    draw_rect(pixels, size, size,
              cx - base_w//2, base_y0,
              cx + base_w//2, base_y1,
              rgba(20, 60, 81))

    # --- Wave (teal) ---
    wave_y = int(155 * s)
    wave_h  = int(12 * s)
    # Draw wave as series of arcs (simplified as a sine-shaped row)
    import math
    for x in range(size):
        rel = x / size
        wy  = wave_y + int(math.sin(rel * math.pi * 4) * wave_h * 0.4)
        for dy in range(wave_h):
            yy = wy + dy
            if 0 <= yy < size:
                alpha = int(255 * (1 - dy/wave_h))
                pixels[yy*size+x] = blend(rgba(37, 183, 187, alpha), pixels[yy*size+x])

    return pixels

def generate(size, path):
    pixels = render_lighthouse(size)
    write_png(path, size, size, pixels)
    print(f"Written {path} ({size}×{size})")

script_dir = os.path.dirname(os.path.abspath(__file__))
generate(192, os.path.join(script_dir, "icon-192.png"))
generate(512, os.path.join(script_dir, "icon-512.png"))
