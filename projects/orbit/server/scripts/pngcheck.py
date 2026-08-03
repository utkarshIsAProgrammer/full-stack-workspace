import zlib, struct, sys

def decode_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8
    idat = b''
    w = h = bitdepth = colortype = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bitdepth, colortype = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    channels = {0:1, 2:3, 3:1, 4:2, 6:4}[colortype]
    bpp = channels
    stride = w * bpp
    out = bytearray(w * h * bpp)
    prev = bytearray(stride)
    i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        if f == 1:
            for x in range(bpp, stride): line[x] = (line[x] + line[x-bpp]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x] = (line[x] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, bpp, out

path = sys.argv[1]
w, h, bpp, px = decode_png(path)
print(f"{path}: {w}x{h} bpp={bpp}")

def pixel(x, y):
    o = (y*w + x) * bpp
    if bpp >= 3:
        return px[o], px[o+1], px[o+2]
    return px[o], px[o], px[o]

# Sample a horizontal strip at several y rows across the full width
# Report runs of very dark pixels vs light pixels (text = light on dark bg)
import collections
for frac in [0.2, 0.3, 0.4, 0.5]:
    y = int(h * frac)
    row = [pixel(x, y) for x in range(0, w, 4)]
    dark = sum(1 for r,g,b in row if r < 30 and g < 30 and b < 30)
    light = sum(1 for r,g,b in row if r > 120 and g > 120 and b > 120)
    print(f"  y={y} ({frac}): dark={dark}/{len(row)} light={light}/{len(row)}")

# Look for a 'black rectangle' region: for each x column, count light pixels over full height
col_light = [0]* (w // 8)
for x in range(0, w - w % 8, 8):
    for y in range(0, h, 8):
        r,g,b = pixel(x, y)
        if r > 120 and g > 120 and b > 120:
            col_light[x//8] += 1
print("Columns with light pixels (first 30):", col_light[:30])
print("Columns with light pixels (last 30):", col_light[-30:])
